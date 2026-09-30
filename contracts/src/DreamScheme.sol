// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @title DreamScheme — 装修设计方案的链上资产（确权 → 流通载体）
/// @notice 一份方案 = 一枚 ERC-721。链上只保存「归因四元组」：
///         creator / parentId / contentHash / agentId——不含任何房间几何数据。
///         parentId = 0 为原创，否则为 remix 来源；谱系由此形成可追溯的树。
/// @dev 版税遵循 ERC-2981：铸造时默认 5%（500 bps）归创作者；
///      创作者可在 5%–10% 区间内调整（协议约束上下限，防滥用）。
///      合约不可升级。
contract DreamScheme is ERC721, ERC2981 {
    /// @notice 版税下限：5%。
    uint96 public constant MIN_ROYALTY_BPS = 500;
    /// @notice 版税上限：10%。
    uint96 public constant MAX_ROYALTY_BPS = 1_000;

    AgentRegistry public immutable agentRegistry;

    struct Scheme {
        address creator; // 方案作者：应用分账的受益人（NFT 转手后不变）
        uint64 parentId; // 0 = 原创；>0 = remix 自该 tokenId
        uint64 createdAt;
        bytes32 contentHash; // 方案 JSON 的 keccak256（承诺 = keccak256(contentHash ‖ salt) 在 ProvenanceRegistry）
        uint64 agentId; // AI 归因（0 = 人类原创 / 未声明）
        string tokenURI; // ipfs:// 元数据（预览图 + 方案 JSON）
    }

    uint256 private _nextTokenId;

    mapping(uint256 tokenId => Scheme) private _schemes;
    mapping(uint256 tokenId => uint256[] childIds) private _children;
    /// @notice 内容哈希 → 首次铸造的 tokenId（供验证工具快速定位，不阻止重复内容）。
    mapping(bytes32 contentHash => uint256 tokenId) public hashToTokenId;

    event SchemeMinted(
        uint256 indexed tokenId, address indexed creator, uint256 indexed parentId, bytes32 contentHash, uint256 agentId
    );
    event RoyaltySet(uint256 indexed tokenId, address indexed receiver, uint96 feeNumerator);

    error InvalidContentHash();
    error EmptyTokenURI();
    error ParentSchemeNotMinted(uint256 parentId);
    error SchemeNotMinted(uint256 tokenId);
    error AgentNotRegistered(uint256 agentId);
    error RoyaltyOutOfBounds(uint96 bps);
    error NotCreator(address caller, uint256 tokenId);

    constructor(AgentRegistry _agentRegistry) ERC721("DreamScheme", "DREAM") {
        agentRegistry = _agentRegistry;
    }

    // ------------------------------------------------------------------ //
    //                              铸造                                   //
    // ------------------------------------------------------------------ //

    /// @notice 铸造一份装修方案。
    /// @param parentId 0 表示原创；大于 0 表示 remix 自该方案（合约校验父方案已铸造）。
    /// @param contentHash 方案 JSON 的 keccak256（原始数据永不上链）。
    /// @param agentId 生成该方案的 AI agent（0 = 无归因；>0 必须已在 AgentRegistry 注册）。
    /// @param metadataURI 元数据 URI，通常为 ipfs://...
    /// @return tokenId 新方案编号（从 1 递增）。
    function mint(uint256 parentId, bytes32 contentHash, uint256 agentId, string calldata metadataURI)
        external
        returns (uint256 tokenId)
    {
        return _mintScheme(msg.sender, parentId, contentHash, agentId, metadataURI);
    }

    /// @notice 语义化 remix 入口，等价于 mint(parentId, contentHash, agentId, metadataURI)。
    function remix(uint256 parentId, bytes32 contentHash, uint256 agentId, string calldata metadataURI)
        external
        returns (uint256 tokenId)
    {
        if (parentId == 0) revert ParentSchemeNotMinted(parentId);
        return _mintScheme(msg.sender, parentId, contentHash, agentId, metadataURI);
    }

    function _mintScheme(
        address creator,
        uint256 parentId,
        bytes32 contentHash,
        uint256 agentId,
        string calldata metadataURI
    ) private returns (uint256 tokenId) {
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        if (bytes(metadataURI).length == 0) revert EmptyTokenURI();
        if (parentId != 0 && _ownerOf(parentId) == address(0)) revert ParentSchemeNotMinted(parentId);
        if (agentId != 0 && !agentRegistry.isRegistered(agentId)) revert AgentNotRegistered(agentId);

        tokenId = ++_nextTokenId;
        _schemes[tokenId] = Scheme({
            creator: creator,
            // forge-lint: disable-next-line(unsafe-typecast)
            parentId: uint64(parentId),
            // forge-lint: disable-next-line(unsafe-typecast)
            createdAt: uint64(block.timestamp),
            contentHash: contentHash,
            // forge-lint: disable-next-line(unsafe-typecast)
            agentId: uint64(agentId),
            tokenURI: metadataURI
        });
        if (hashToTokenId[contentHash] == 0) {
            hashToTokenId[contentHash] = tokenId;
        }
        if (parentId != 0) {
            _children[parentId].push(tokenId);
        }

        // 铸造即设默认版税：5% 归创作者（ERC-2981）
        _setTokenRoyalty(tokenId, creator, MIN_ROYALTY_BPS);

        _safeMint(creator, tokenId);
        emit SchemeMinted(tokenId, creator, parentId, contentHash, agentId);
    }

    // ------------------------------------------------------------------ //
    //                             版税                                    //
    // ------------------------------------------------------------------ //

    /// @notice 创作者调整自己方案的版税（限定 5%–10%）。
    function setRoyalty(uint256 tokenId, uint96 feeNumerator) external {
        address creator = _schemes[tokenId].creator;
        if (creator == address(0)) revert SchemeNotMinted(tokenId);
        if (msg.sender != creator) revert NotCreator(msg.sender, tokenId);
        if (feeNumerator < MIN_ROYALTY_BPS || feeNumerator > MAX_ROYALTY_BPS) revert RoyaltyOutOfBounds(feeNumerator);
        _setTokenRoyalty(tokenId, creator, feeNumerator);
        emit RoyaltySet(tokenId, creator, feeNumerator);
    }

    // ------------------------------------------------------------------ //
    //                          谱系查询                                   //
    // ------------------------------------------------------------------ //

    function schemeOf(uint256 tokenId) external view returns (Scheme memory) {
        _requireOwned(tokenId);
        return _schemes[tokenId];
    }

    /// @notice 方案作者地址（归因与分账；NFT 转手后不变）。
    function creatorOf(uint256 tokenId) public view returns (address) {
        return _schemes[tokenId].creator;
    }

    function parentOf(uint256 tokenId) external view returns (uint256) {
        return _schemes[tokenId].parentId;
    }

    function contentHashOf(uint256 tokenId) external view returns (bytes32) {
        return _schemes[tokenId].contentHash;
    }

    function agentIdOf(uint256 tokenId) external view returns (uint256) {
        return _schemes[tokenId].agentId;
    }

    function createdAtOf(uint256 tokenId) external view returns (uint256) {
        return _schemes[tokenId].createdAt;
    }

    /// @notice 某方案的全部直接衍生方案。
    function childrenOf(uint256 tokenId) external view returns (uint256[] memory) {
        return _children[tokenId];
    }

    /// @notice 直接衍生数量（画廊卡片与排行榜）。
    function remixCount(uint256 tokenId) external view returns (uint256) {
        return _children[tokenId].length;
    }

    /// @notice 从原创到当前方案的完整谱系（含自身，升序）。
    function lineageOf(uint256 tokenId) external view returns (uint256[] memory lineage) {
        _requireOwned(tokenId);
        uint256 depth = 0;
        uint256 cursor = tokenId;
        while (cursor != 0) {
            depth++;
            cursor = _schemes[cursor].parentId;
        }
        lineage = new uint256[](depth);
        cursor = tokenId;
        for (uint256 i = depth; i > 0; --i) {
            lineage[i - 1] = cursor;
            cursor = _schemes[cursor].parentId;
        }
    }

    /// @notice 与某方案同一作者的「版本链」（同作者连续升级 v1→v2→v3）。
    function versionLineOf(uint256 tokenId) external view returns (uint256[] memory versions) {
        _requireOwned(tokenId);
        address author = _schemes[tokenId].creator;

        uint256 root = tokenId;
        while (true) {
            uint256 parent = _schemes[root].parentId;
            if (parent == 0 || _schemes[parent].creator != author) break;
            root = parent;
        }

        uint256[] memory buffer = new uint256[](256);
        uint256 n = 0;
        buffer[n++] = root;
        uint256 i = 0;
        while (i < n && n < buffer.length) {
            uint256 nodeId = buffer[i++];
            uint256[] memory children = _children[nodeId];
            for (uint256 j = 0; j < children.length && n < buffer.length; j++) {
                if (_schemes[children[j]].creator == author) {
                    buffer[n++] = children[j];
                }
            }
        }

        for (uint256 a = 1; a < n; a++) {
            uint256 key = buffer[a];
            uint256 b = a;
            while (b > 0 && buffer[b - 1] > key) {
                buffer[b] = buffer[b - 1];
                b--;
            }
            buffer[b] = key;
        }

        versions = new uint256[](n);
        for (uint256 k = 0; k < n; k++) {
            versions[k] = buffer[k];
        }
    }

    /// @notice 已铸造方案总数。
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _schemes[tokenId].tokenURI;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return ERC721.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}
