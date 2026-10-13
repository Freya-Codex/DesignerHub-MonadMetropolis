// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @title DreamScheme — on-chain asset for a design scheme (attribution → circulation carrier)
/// @notice One scheme = one ERC-721. Only the "attribution quadruple" is stored on-chain:
///         creator / parentId / contentHash / agentId — no room geometry whatsoever.
///         parentId = 0 means original, otherwise it is the remix source; lineage thus forms a traceable tree.
/// @dev Royalties follow ERC-2981: 5% (500 bps) to the creator by default at mint;
///      the creator may adjust it between 5% and 10% (the protocol bounds both ends to prevent abuse).
///      The contract is non-upgradeable.
contract DreamScheme is ERC721, ERC2981 {
    /// @notice Royalty floor: 5%.
    uint96 public constant MIN_ROYALTY_BPS = 500;
    /// @notice Royalty ceiling: 10%.
    uint96 public constant MAX_ROYALTY_BPS = 1_000;

    AgentRegistry public immutable agentRegistry;

    struct Scheme {
        address creator; // scheme author: beneficiary of the apply split (unchanged if the NFT is transferred)
        uint64 parentId; // 0 = original; >0 = remixed from that tokenId
        uint64 createdAt;
        bytes32 contentHash; // keccak256 of the scheme JSON (commitment = keccak256(contentHash ‖ salt) in ProvenanceRegistry)
        uint64 agentId; // AI attribution (0 = human original / undeclared)
        string tokenURI; // ipfs:// metadata (preview image + scheme JSON)
    }

    uint256 private _nextTokenId;

    mapping(uint256 tokenId => Scheme) private _schemes;
    mapping(uint256 tokenId => uint256[] childIds) private _children;
    /// @notice content hash → tokenId of the first mint (lets verifiers locate it quickly; does not block duplicate content).
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
    //                              Mint                                   //
    // ------------------------------------------------------------------ //

    /// @notice Mint a design scheme.
    /// @param parentId 0 means original; greater than 0 means remixed from that scheme (the contract checks the parent is minted).
    /// @param contentHash keccak256 of the scheme JSON (raw data never goes on-chain).
    /// @param agentId the AI agent that generated the scheme (0 = no attribution; if >0 it must be registered in AgentRegistry).
    /// @param metadataURI metadata URI, usually ipfs://...
    /// @return tokenId the new scheme id (incrementing from 1).
    function mint(uint256 parentId, bytes32 contentHash, uint256 agentId, string calldata metadataURI)
        external
        returns (uint256 tokenId)
    {
        return _mintScheme(msg.sender, parentId, contentHash, agentId, metadataURI);
    }

    /// @notice Semantic remix entry, equivalent to mint(parentId, contentHash, agentId, metadataURI).
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

        // Set the default royalty at mint: 5% to the creator (ERC-2981)
        _setTokenRoyalty(tokenId, creator, MIN_ROYALTY_BPS);

        _safeMint(creator, tokenId);
        emit SchemeMinted(tokenId, creator, parentId, contentHash, agentId);
    }

    // ------------------------------------------------------------------ //
    //                            Royalty                                  //
    // ------------------------------------------------------------------ //

    /// @notice The creator adjusts the royalty of their own scheme (bounded to 5%–10%).
    function setRoyalty(uint256 tokenId, uint96 feeNumerator) external {
        address creator = _schemes[tokenId].creator;
        if (creator == address(0)) revert SchemeNotMinted(tokenId);
        if (msg.sender != creator) revert NotCreator(msg.sender, tokenId);
        if (feeNumerator < MIN_ROYALTY_BPS || feeNumerator > MAX_ROYALTY_BPS) revert RoyaltyOutOfBounds(feeNumerator);
        _setTokenRoyalty(tokenId, creator, feeNumerator);
        emit RoyaltySet(tokenId, creator, feeNumerator);
    }

    // ------------------------------------------------------------------ //
    //                        Lineage queries                               //
    // ------------------------------------------------------------------ //

    function schemeOf(uint256 tokenId) external view returns (Scheme memory) {
        _requireOwned(tokenId);
        return _schemes[tokenId];
    }

    /// @notice Scheme author address (attribution and split; unchanged if the NFT is transferred).
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

    /// @notice All direct derivative schemes of a scheme.
    function childrenOf(uint256 tokenId) external view returns (uint256[] memory) {
        return _children[tokenId];
    }

    /// @notice Number of direct derivatives (gallery cards and leaderboard).
    function remixCount(uint256 tokenId) external view returns (uint256) {
        return _children[tokenId].length;
    }

    /// @notice Full lineage from the original to the current scheme (inclusive, ascending).
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

    /// @notice The "version chain" of a scheme by the same author (same author iterating v1→v2→v3).
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

    /// @notice Total number of minted schemes.
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
