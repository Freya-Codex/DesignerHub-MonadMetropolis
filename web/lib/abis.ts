import { parseAbi } from "viem";

export const dreamSchemeAbi = parseAbi([
  "function mint(uint256 parentId, bytes32 contentHash, string calldata metadataURI) external returns (uint256)",
  "function remix(uint256 parentId, bytes32 contentHash, string calldata metadataURI) external returns (uint256)",
  "function creatorOf(uint256 tokenId) external view returns (address)",
  "function parentOf(uint256 tokenId) external view returns (uint256)",
  "function contentHashOf(uint256 tokenId) external view returns (bytes32)",
  "function createdAtOf(uint256 tokenId) external view returns (uint256)",
  "function childrenOf(uint256 tokenId) external view returns (uint256[])",
  "function remixCount(uint256 tokenId) external view returns (uint256)",
  "function lineageOf(uint256 tokenId) external view returns (uint256[])",
  "function versionLineOf(uint256 tokenId) external view returns (uint256[])",
  "function totalSupply() external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function hashToTokenId(bytes32) external view returns (uint256)",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256)",
  "function supportsInterface(bytes4) external view returns (bool)",
  "event SchemeMinted(uint256 indexed tokenId, address indexed creator, uint256 indexed parentId, bytes32 contentHash)"
]);

export const schemeMarketAbi = parseAbi([
  "function applyScheme(uint256 tokenId) external payable returns (uint256, uint256)",
  "function withdraw() external returns (uint256)",
  "function appliedCount(uint256 tokenId) external view returns (uint256)",
  "function totalApplied() external view returns (uint256)",
  "function applyPrice() external view returns (uint256)",
  "function platformAddress() external view returns (address)",
  "function pendingWithdrawals(address) external view returns (uint256)",
  "function splitOf(uint256 amount) external view returns (uint256, uint256)",
  "event SchemeApplied(uint256 indexed tokenId, address indexed applier, address indexed creator, uint256 value, uint256 creatorShare, uint256 platformShare)"
]);

export const schemeMintedEvent = parseAbi([
  "event SchemeMinted(uint256 indexed tokenId, address indexed creator, uint256 indexed parentId, bytes32 contentHash)"
])[0];

export const schemeAppliedEvent = parseAbi([
  "event SchemeApplied(uint256 indexed tokenId, address indexed applier, address indexed creator, uint256 value, uint256 creatorShare, uint256 platformShare)"
])[0];
