// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VirtuHomeScheme} from "./VirtuHomeScheme.sol";

/// @title SchemeMarket
/// @notice 「应用到我家」付费入口：支付固定价格把一份方案应用到自己的房间。
///         金额按 90%（创作者）/ 10%（平台）分账，平台份额累积后可随时提取。
contract SchemeMarket is Ownable, ReentrancyGuard {
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant DEFAULT_APPLY_PRICE = 0.01 ether;

    VirtuHomeScheme public immutable scheme;
    address public platformAddress;
    uint256 public creatorShareBps = 9_000; // 90%
    uint256 public applyPrice = DEFAULT_APPLY_PRICE;

    /// @notice 累计成功应用的次数。
    uint256 public totalApplied;
    /// @notice 每个方案的被应用次数，排行榜使用。
    mapping(uint256 tokenId => uint256 count) public appliedCount;
    /// @notice 各账户可提取余额：平台分成 + 无法直接收款时的创作者代管份额。
    mapping(address account => uint256 amount) public pendingWithdrawals;

    event SchemeApplied(
        uint256 indexed tokenId,
        address indexed applier,
        address indexed creator,
        uint256 value,
        uint256 creatorShare,
        uint256 platformShare
    );
    event PlatformAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event ApplyPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event CreatorShareUpdated(uint256 oldShareBps, uint256 newShareBps);
    event Withdrawn(address indexed account, uint256 amount);
    event CreatorShareEscrowed(uint256 indexed tokenId, address indexed creator, uint256 amount);

    error SchemeNotMinted(uint256 tokenId);
    error InvalidPaymentAmount(uint256 paid, uint256 expected);
    error CreatorTransferFailed(address creator);
    error InvalidPlatformAddress();
    error NothingToWithdraw();
    error WithdrawFailed();

    constructor(VirtuHomeScheme scheme_, address initialOwner, address platformAddress_) Ownable(initialOwner) {
        scheme = scheme_;
        platformAddress = platformAddress_ == address(0) ? initialOwner : platformAddress_;
    }

    /// @notice 把方案应用到自己的家，费用按 90/10 自动分账。
    /// @param tokenId 要应用的方案编号。
    /// @return creatorShare 归创作者的金额。
    /// @return platformShare 归平台的金额。
    function applyScheme(uint256 tokenId) external payable nonReentrant returns (uint256 creatorShare, uint256 platformShare) {
        address creator = scheme.creatorOf(tokenId);
        if (creator == address(0)) revert SchemeNotMinted(tokenId);
        if (msg.value != applyPrice) revert InvalidPaymentAmount(msg.value, applyPrice);

        creatorShare = (msg.value * creatorShareBps) / MAX_BPS;
        platformShare = msg.value - creatorShare; // 取整余数留在平台侧，保证不产生悬浮资金

        appliedCount[tokenId] += 1;
        totalApplied += 1;
        pendingWithdrawals[platformAddress] += platformShare;

        (bool paid, ) = payable(creator).call{value: creatorShare}("");
        if (!paid) {
            // 创作者是拒收转账的合约时，先计入平台代管，避免整个应用流程被卡死。
            pendingWithdrawals[platformAddress] += creatorShare;
            emit CreatorShareEscrowed(tokenId, creator, creatorShare);
        }

        emit SchemeApplied(tokenId, msg.sender, creator, msg.value, creatorShare, platformShare);
    }

    /// @notice 提取自己累积的余额（平台分成或代管份额）。
    function withdraw() external nonReentrant returns (uint256 amount) {
        amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice 按当前费率预览分账结果，前端展示用。
    function splitOf(uint256 amount) external view returns (uint256 creatorShare, uint256 platformShare) {
        creatorShare = (amount * creatorShareBps) / MAX_BPS;
        platformShare = amount - creatorShare;
    }

    function setPlatformAddress(address newAddress) external onlyOwner {
        if (newAddress == address(0)) revert InvalidPlatformAddress();
        emit PlatformAddressUpdated(platformAddress, newAddress);
        platformAddress = newAddress;
    }

    function setApplyPrice(uint256 newPrice) external onlyOwner {
        emit ApplyPriceUpdated(applyPrice, newPrice);
        applyPrice = newPrice;
    }

    function setCreatorShareBps(uint256 newShareBps) external onlyOwner {
        require(newShareBps <= MAX_BPS, "share exceeds 100%");
        emit CreatorShareUpdated(creatorShareBps, newShareBps);
        creatorShareBps = newShareBps;
    }
}
