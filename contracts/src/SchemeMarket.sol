// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DreamScheme} from "./DreamScheme.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SchemeMarket — 方案「使用权」交易与谱系分账
///
/// @notice 价格由**创作者**为每个方案单独设定（setPrice）；购买使用权
///         （applyScheme）时按谱系自动分流：
///
///   - 原创方案被应用：创作者 90% / 平台 10%；
///   - 衍生方案被应用：二创作者 85% / 平台 10% / 原作谱系共享 5%
///     （多个祖先去重后均分；若某祖先就是二创作者本人，其份额并入 85% 主体）。
///
///         谱系回溯上限 16 层；取整余数归平台，保证无悬浮资金。
/// @dev 合约不可升级；平台地址在构造时固化。收款失败直接 revert（原子性优先）。
contract SchemeMarket is ReentrancyGuard {
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant CREATOR_BPS_ORIGINAL = 9_000; // 原创被应用：创作者 90%
    uint256 public constant CREATOR_BPS_REMIX = 8_500; // 衍生被应用：二创作者 85%
    uint256 public constant PLATFORM_BPS = 1_000; // 平台 10%
    /// @notice 谱系回溯最大深度。
    uint256 public constant MAX_LINEAGE_DEPTH = 16;

    DreamScheme public immutable scheme;
    /// @notice 平台收益地址（构造时固化，不可变 = 抗单点捕获的一部分）。
    address payable public immutable platform;

    /// @notice 每个方案的使用权价格（wei）；0 = 未上架。
    mapping(uint256 tokenId => uint256 price) public priceOf;

    /// @notice 累计成功应用次数（全局）。
    uint256 public totalApplied;
    /// @notice 每个方案被应用的次数（排行榜）。
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
    /// @notice 衍生方案被应用时，按谱系付给祖先创作者的份额。
    event AncestorPaid(uint256 indexed tokenId, address indexed ancestor, uint256 amount);

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
    //                            定价                                     //
    // ------------------------------------------------------------------ //

    /// @notice 创作者为自己的方案设定使用权价格；价格 > 0 即上架，0 即下架。
    function setPrice(uint256 tokenId, uint256 price) external {
        address creator = scheme.creatorOf(tokenId);
        if (creator == address(0)) revert SchemeNotMinted(tokenId);
        if (msg.sender != creator) revert NotCreator(msg.sender, tokenId);
        priceOf[tokenId] = price;
        emit PriceSet(tokenId, creator, price);
    }

    // ------------------------------------------------------------------ //
    //                          购买使用权                                 //
    // ------------------------------------------------------------------ //

    /// @notice 支付创作者定价购买一份方案的使用权，金额按谱系自动分账。
    /// @dev 多付部分自动退回 msg.sender。
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
            // —— 原创方案：90 / 10 ——
            creatorCut = (price * CREATOR_BPS_ORIGINAL) / MAX_BPS;
            platformCut = price - creatorCut;
            _pay(creator, creatorCut);
        } else {
            // —— 衍生方案：85（二创作者）/ 10（平台）/ 5（原作谱系，均分） ——
            creatorCut = (price * CREATOR_BPS_REMIX) / MAX_BPS;
            platformCut = (price * PLATFORM_BPS) / MAX_BPS;
            ancestorPool = price - creatorCut - platformCut; // ≈5%，吸收取整误差

            address[] memory ancestors = _uniqueAncestorCreators(tokenId);
            if (ancestors.length == 0) {
                // 谱系回溯为空（理论不可达）：并入平台，避免悬浮资金
                platformCut += ancestorPool;
            } else {
                uint256 each = ancestorPool / ancestors.length;
                platformCut += ancestorPool - each * ancestors.length; // 取整余数归平台
                uint256 extraToCreator = 0;
                for (uint256 i = 0; i < ancestors.length; i++) {
                    if (ancestors[i] == creator) {
                        // 祖先即二创作者本人：并入其主体份额
                        extraToCreator += each;
                    } else {
                        _pay(ancestors[i], each);
                        emit AncestorPaid(tokenId, ancestors[i], each);
                    }
                }
                _pay(creator, creatorCut + extraToCreator);
                creatorCut += extraToCreator;
            }
        }
        _pay(platform, platformCut);

        // 多付部分退款
        if (msg.value > price) {
            _pay(msg.sender, msg.value - price);
        }

        emit SchemeApplied(tokenId, msg.sender, creator, price, creatorCut, platformCut);
    }

    // ------------------------------------------------------------------ //
    //                            查询                                     //
    // ------------------------------------------------------------------ //

    /// @notice 预览某价格下的分账（原创 90/10 或按谱系 85/10/5）。
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
        ancestors = _uniqueAncestorCreators(tokenId);
        return (creatorCut, platformCut, ancestorPool, ancestors);
    }

    // ------------------------------------------------------------------ //
    //                            内部                                     //
    // ------------------------------------------------------------------ //

    /// @dev 沿 parentId 收集去重后的祖先创作者（≤16 层）。
    function _uniqueAncestorCreators(uint256 tokenId) private view returns (address[] memory ancestors) {
        uint256 depth = 0;
        uint256 cursor = scheme.parentOf(tokenId);
        while (cursor != 0 && depth < MAX_LINEAGE_DEPTH) {
            cursor = scheme.parentOf(cursor);
            depth++;
        }
        ancestors = new address[](depth);
        uint256 n = 0;
        cursor = scheme.parentOf(tokenId);
        while (cursor != 0 && n < depth) {
            address c = scheme.creatorOf(cursor);
            bool dup = false;
            for (uint256 j = 0; j < n && !dup; j++) {
                if (ancestors[j] == c) dup = true;
            }
            if (!dup) {
                ancestors[n++] = c;
            }
            cursor = scheme.parentOf(cursor);
        }
        // 裁剪到实际数量
        assembly {
            mstore(ancestors, n)
        }
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert PaymentFailed(to);
    }
}
