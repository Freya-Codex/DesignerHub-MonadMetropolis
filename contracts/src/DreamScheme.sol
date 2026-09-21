// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DreamScheme
/// @notice 云筑家装修设计方案的链上创作资产：一份方案 = 一枚 ERC-721。
///         支持原创铸造与 remix 衍生，形成可归因、可追溯的创作谱系。
/// @dev 本合约只管「归属 + 谱系」，资金分账由 SchemeMarket 负责。
contract DreamScheme is ERC721, ERC2981, Ownable {
    /// @notice 版税费率（基点），5% = 500。
    uint96 public constant ROYALTY_BPS = 500;
    /// @notice 版税上限，10% = 1000 基点。
    uint96 public constant MAX_ROYALTY_BPS = 1_000;

    struct Scheme {
        address creator; // 方案作者：应用付费的 90% 归此人（转手后也不变）
        uint64 parentId; // 0 = 原创；>0 = remix 自该 tokenId
        uint64 createdAt; // 铸造时间戳
        bytes32 contentHash; // 方案 JSON 的 keccak256 哈希
        string tokenURI; // ipfs:// 元数据（含预览图 + 方案 JSON）
    }

    uint256 private _nextTokenId;

    mapping(uint256 tokenId => Scheme) private _schemes;
    mapping(uint256 tokenId => uint256[] childIds) private _children;
    /// @notice 内容哈希 → 首次铸造的 tokenId（仅供参考，不阻止重复内容再次 mint）。
    mapping(bytes32 contentHash => uint256 tokenId) public hashToTokenId;

    event SchemeMinted(uint256 indexed tokenId, address indexed creator, uint256 indexed parentId, bytes32 contentHash);
    event RoyaltyUpdated(address indexed receiver, uint96 feeNumerator);

    error InvalidContentHash();
    error EmptyTokenURI();
    error ParentSchemeNotMinted(uint256 parentId);

    constructor(address initialOwner, address royaltyReceiver)
        ERC721("YunZhuJia DreamScheme", "YZJ")
        Ownable(initialOwner)
    {
        _setDefaultRoyalty(royaltyReceiver == address(0) ? initialOwner : royaltyReceiver, ROYALTY_BPS);
    }

    /// @notice 铸造一份装修方案。
    /// @param parentId 0 表示原创；大于 0 表示 remix 自该方案，合约会校验父方案已铸造。
    /// @param contentHash 方案 JSON 的 keccak256 哈希。
    /// @param metadataURI 方案元数据 URI，通常为 ipfs://...
    /// @return tokenId 新铸造的方案编号（从 1 开始递增）。
    function mint(uint256 parentId, bytes32 contentHash, string calldata metadataURI) external returns (uint256 tokenId) {
        return _mintScheme(msg.sender, parentId, contentHash, metadataURI);
    }

    /// @notice 语义化的 remix 入口，等价于 mint(parentId, contentHash, metadataURI)。
    function remix(uint256 parentId, bytes32 contentHash, string calldata metadataURI) external returns (uint256 tokenId) {
        if (parentId == 0) revert ParentSchemeNotMinted(parentId);
        return _mintScheme(msg.sender, parentId, contentHash, metadataURI);
    }

    function _mintScheme(address creator, uint256 parentId, bytes32 contentHash, string calldata metadataURI)
        private
        returns (uint256 tokenId)
    {
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        if (bytes(metadataURI).length == 0) revert EmptyTokenURI();
        if (parentId != 0 && _ownerOf(parentId) == address(0)) revert ParentSchemeNotMinted(parentId);

        tokenId = ++_nextTokenId;
        _schemes[tokenId] = Scheme({
            creator: creator,
            // forge-lint: disable-next-line(unsafe-typecast)
            parentId: uint64(parentId),
            // forge-lint: disable-next-line(unsafe-typecast)
            createdAt: uint64(block.timestamp),
            contentHash: contentHash,
            tokenURI: metadataURI
        });
        if (hashToTokenId[contentHash] == 0) {
            hashToTokenId[contentHash] = tokenId;
        }
        if (parentId != 0) {
            _children[parentId].push(tokenId);
        }

        _safeMint(creator, tokenId);
        emit SchemeMinted(tokenId, creator, parentId, contentHash);
    }

    function schemeOf(uint256 tokenId) external view returns (Scheme memory) {
        _requireOwned(tokenId);
        return _schemes[tokenId];
    }

    /// @notice 方案作者地址，用于归因与分账；NFT 转手后 creator 保持不变。
    function creatorOf(uint256 tokenId) public view returns (address) {
        return _schemes[tokenId].creator;
    }

    function parentOf(uint256 tokenId) external view returns (uint256) {
        return _schemes[tokenId].parentId;
    }

    function contentHashOf(uint256 tokenId) external view returns (bytes32) {
        return _schemes[tokenId].contentHash;
    }

    function createdAtOf(uint256 tokenId) external view returns (uint256) {
        return _schemes[tokenId].createdAt;
    }

    /// @notice 某方案的全部直接衍生方案。
    function childrenOf(uint256 tokenId) external view returns (uint256[] memory) {
        return _children[tokenId];
    }

    /// @notice 某方案直接衍生的数量，用于画廊卡片与排行榜。
    function remixCount(uint256 tokenId) external view returns (uint256) {
        return _children[tokenId].length;
    }

    /// @notice 从原创方案到当前方案的完整谱系（含自身，按铸造顺序升序）。
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

    /// @notice 与某方案同一作者构成的「版本链」（按铸造顺序升序，含自身）。
    ///         同一作者铸造新版本时 parentId 指向自己上一版，即形成 v1→v2→v3；
    ///         其他作者的 remix 不会混入版本链。
    function versionLineOf(uint256 tokenId) external view returns (uint256[] memory versions) {
        _requireOwned(tokenId);
        address author = _schemes[tokenId].creator;

        // 1) 向前回溯到该作者版本链的树根（上一版必须是同作者）
        uint256 root = tokenId;
        while (true) {
            uint256 parent = _schemes[root].parentId;
            if (parent == 0 || _schemes[parent].creator != author) break;
            root = parent;
        }

        // 2) BFS 收集以 root 为根的子树中同作者的全部方案（最多 256 个）
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

        // 3) 按 tokenId（= 铸造顺序）升序排列
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

    /// @notice 当前已铸造的方案总数（tokenId 从 1 递增，故等于最大 tokenId）。
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _schemes[tokenId].tokenURI;
    }

    /// @notice 平台可调整版税接收地址与费率（上限 10%）。
    function setRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        require(receiver != address(0), "receiver required");
        require(feeNumerator <= MAX_ROYALTY_BPS, "fee exceeds 10%");
        _setDefaultRoyalty(receiver, feeNumerator);
        emit RoyaltyUpdated(receiver, feeNumerator);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return ERC721.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}
