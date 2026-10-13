// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DreamScheme} from "./DreamScheme.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SchemeMarket — scheme "usage rights" trading and lineage-aware splits
///
/// @notice The price is set by the **creator** for each scheme individually (setPrice); when usage rights are
///         purchased (applyScheme) the payment is routed automatically along the lineage:
///
///   - an original scheme is applied: creator 90% / platform 10%;
///   - a derivative scheme is applied: remixer 85% / platform 10% / original lineage pool 5%
///     (deduplicated ancestors split evenly; if an ancestor is the remixer themselves, their share folds into the 85% main portion).
///
///         Lineage backtracking is capped at 16 levels; rounding remainders go to the platform, so no funds are left floating.
/// @dev Non-upgradeable; the platform address is fixed at construction. A failed payment reverts directly (atomicity first).
contract SchemeMarket is ReentrancyGuard {
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant CREATOR_BPS_ORIGINAL = 9_000; // original applied: creator 90%
    uint256 public constant CREATOR_BPS_REMIX = 8_500; // derivative applied: remixer 85%
    uint256 public constant PLATFORM_BPS = 1_000; // platform 10%
    /// @notice Maximum lineage backtracking depth.
    uint256 public constant MAX_LINEAGE_DEPTH = 16;

    DreamScheme public immutable scheme;
    /// @notice Platform revenue address (fixed at construction, immutable = part of the resistance to single-point capture).
    address payable public immutable platform;

    /// @notice Usage-rights price of each scheme (wei); 0 = not listed.
    mapping(uint256 tokenId => uint256 price) public priceOf;

    /// @notice Optional **payout address** per scheme (0 = default, pay creatorOf directly).
    ///         Lets a passkey smart account keep its "identity" while revenue optionally goes straight to an external wallet.
    mapping(uint256 tokenId => address payout) public payoutOf;

    /// @notice Cumulative successful applies (global).
    uint256 public totalApplied;
    /// @notice Per-scheme apply count (leaderboard).
    mapping(uint256 tokenId => uint256 count) public appliedCount;

    event PriceSet(uint256 indexed tokenId, address indexed creator, uint256 price);
    event SchemeApplied(
        uint256 indexed tokenId,
        address indexed applier,
        address indexed creator,
        uint256 price,
        uint256 creatorCut,
        uint256 platformCut
    );
    /// @notice When a derivative scheme is applied, the share paid to ancestor creators along the lineage.
    event AncestorPaid(uint256 indexed tokenId, address indexed ancestor, uint256 amount);
    /// @notice The creator updates a scheme's payout address.
    event PayoutSet(uint256 indexed tokenId, address indexed creator, address payout);

    error SchemeNotMinted(uint256 tokenId);
    error NotListed(uint256 tokenId);
    error InvalidPaymentAmount(uint256 paid, uint256 expected);
    error NotCreator(address caller, uint256 tokenId);
    error PaymentFailed(address to);

    constructor(DreamScheme scheme_, address payable platform_) {
        scheme = scheme_;
        platform = platform_;
    }

    // ------------------------------------------------------------------ //
    //                           Pricing                                  //
    // ------------------------------------------------------------------ //

    /// @notice A creator sets the usage-rights price of their own scheme; price > 0 lists it, 0 delists it.
    function setPrice(uint256 tokenId, uint256 price) external {
        address creator = scheme.creatorOf(tokenId);
        if (creator == address(0)) revert SchemeNotMinted(tokenId);
        if (msg.sender != creator) revert NotCreator(msg.sender, tokenId);
        priceOf[tokenId] = price;
        emit PriceSet(tokenId, creator, price);
    }

    /// @notice A creator sets a scheme's payout address (0 = restore default, pay the creator address directly).
    /// @dev The payout address affects only "where the money goes", not identity / ownership / lineage attribution;
    ///      a passkey creator can point it at their external wallet so funds do not sit in the smart account.
    function setPayout(uint256 tokenId, address payout) external {
        address creator = scheme.creatorOf(tokenId);
        if (creator == address(0)) revert SchemeNotMinted(tokenId);
        if (msg.sender != creator) revert NotCreator(msg.sender, tokenId);
        payoutOf[tokenId] = payout;
        emit PayoutSet(tokenId, creator, payout);
    }

    // ------------------------------------------------------------------ //
    //                      Purchase usage rights                       //
    // ------------------------------------------------------------------ //

    /// @notice Pay the creator's price to purchase usage rights for a scheme; the amount is split along the lineage automatically.
    /// @dev Any overpayment is automatically refunded to msg.sender.
    function applyScheme(uint256 tokenId)
        external
        payable
        nonReentrant
        returns (uint256 creatorCut, uint256 platformCut)
    {
        address creator = scheme.creatorOf(tokenId);
        if (creator == address(0)) revert SchemeNotMinted(tokenId);
        uint256 price = priceOf[tokenId];
        if (price == 0) revert NotListed(tokenId);
        if (msg.value < price) revert InvalidPaymentAmount(msg.value, price);

        appliedCount[tokenId] += 1;
        totalApplied += 1;

        uint256 ancestorPool;
        if (scheme.parentOf(tokenId) == 0) {
            // —— Original scheme: 90 / 10 ——
            creatorCut = (price * CREATOR_BPS_ORIGINAL) / MAX_BPS;
            platformCut = price - creatorCut;
            _pay(_payee(tokenId), creatorCut);
        } else {
            // —— Derivative scheme: 85 (remixer) / 10 (platform) / 5 (original lineage, split evenly) ——
            creatorCut = (price * CREATOR_BPS_REMIX) / MAX_BPS;
            platformCut = (price * PLATFORM_BPS) / MAX_BPS;
            ancestorPool = price - creatorCut - platformCut; // ≈5%, absorbs rounding error

            address creatorPayee = _payee(tokenId);
            address[] memory payees = _uniqueAncestorPayees(tokenId);
            if (payees.length == 0) {
                // Lineage backtracking is empty (theoretically unreachable): fold into the platform to avoid floating funds
                platformCut += ancestorPool;
            } else {
                uint256 each = ancestorPool / payees.length;
                platformCut += ancestorPool - each * payees.length; // rounding remainder goes to the platform
                uint256 extraToCreator = 0;
                for (uint256 i = 0; i < payees.length; i++) {
                    if (payees[i] == creatorPayee) {
                        // The ancestor's payout address is the remixer themselves: fold into their main share
                        extraToCreator += each;
                    } else {
                        _pay(payees[i], each);
                        emit AncestorPaid(tokenId, payees[i], each);
                    }
                }
                _pay(creatorPayee, creatorCut + extraToCreator);
                creatorCut += extraToCreator;
            }
        }
        _pay(platform, platformCut);

        // Refund overpayment
        if (msg.value > price) {
            _pay(msg.sender, msg.value - price);
        }

        emit SchemeApplied(tokenId, msg.sender, creator, price, creatorCut, platformCut);
    }

    // ------------------------------------------------------------------ //
    //                            Queries                                //
    // ------------------------------------------------------------------ //

    /// @notice Preview the split for a given price (90/10 for originals, or 85/10/5 along the lineage).
    /// @dev The third return value is the "ancestor payout addresses" (deduplicated); when payout is unset it is the ancestor creator address.
    function splitPreview(uint256 tokenId, uint256 amount)
        external
        view
        returns (uint256 creatorCut, uint256 platformCut, uint256 ancestorPool, address[] memory ancestors)
    {
        if (scheme.parentOf(tokenId) == 0) {
            creatorCut = (amount * CREATOR_BPS_ORIGINAL) / MAX_BPS;
            platformCut = amount - creatorCut;
            return (creatorCut, platformCut, 0, ancestors);
        }
        creatorCut = (amount * CREATOR_BPS_REMIX) / MAX_BPS;
        platformCut = (amount * PLATFORM_BPS) / MAX_BPS;
        ancestorPool = amount - creatorCut - platformCut;
        ancestors = _uniqueAncestorPayees(tokenId);
        return (creatorCut, platformCut, ancestorPool, ancestors);
    }

    // ------------------------------------------------------------------ //
    //                           Internal                                //
    // ------------------------------------------------------------------ //

    /// @dev A scheme's payout address: use payoutOf if non-zero, otherwise fall back to the creator address.
    function _payee(uint256 tokenId) private view returns (address) {
        address p = payoutOf[tokenId];
        return p == address(0) ? scheme.creatorOf(tokenId) : p;
    }

    /// @dev Walk parentId to collect the deduplicated ancestor **payout addresses** (≤16 levels). When payout is unset it is the ancestor creator.
    function _uniqueAncestorPayees(uint256 tokenId) private view returns (address[] memory payees) {
        uint256 depth = 0;
        uint256 cursor = scheme.parentOf(tokenId);
        uint256[] memory ids = new uint256[](MAX_LINEAGE_DEPTH);
        while (cursor != 0 && depth < MAX_LINEAGE_DEPTH) {
            ids[depth++] = cursor;
            cursor = scheme.parentOf(cursor);
        }
        address[] memory tmp = new address[](depth);
        uint256 n = 0;
        for (uint256 i = 0; i < depth; i++) {
            address p = _payee(ids[i]);
            bool dup = false;
            for (uint256 j = 0; j < n && !dup; j++) {
                if (tmp[j] == p) dup = true;
            }
            if (!dup) {
                tmp[n++] = p;
            }
        }
        payees = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            payees[i] = tmp[i];
        }
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert PaymentFailed(to);
    }
}
