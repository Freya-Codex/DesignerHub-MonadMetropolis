/**
 * Contract ABIs.
 *
 * NOTE: `parseAbi` (abitype) does not support tuples/structs in human-readable ABIs,
 * so the passkey account/factory ABIs are declared as JSON ABIs instead.
 */

import { parseAbi } from "viem";

/** DreamScheme — scheme NFT (lineage remix + ERC-2981 royalty + AI agent attribution). */
export const dreamSchemeAbi = parseAbi([
  "function mint(uint256 parentId, bytes32 contentHash, uint256 agentId, string calldata metadataURI) external returns (uint256)",
  "function remix(uint256 parentId, bytes32 contentHash, uint256 agentId, string calldata metadataURI) external returns (uint256)",
  "function creatorOf(uint256 tokenId) external view returns (address)",
  "function parentOf(uint256 tokenId) external view returns (uint256)",
  "function contentHashOf(uint256 tokenId) external view returns (bytes32)",
  "function agentIdOf(uint256 tokenId) external view returns (uint256)",
  "function createdAtOf(uint256 tokenId) external view returns (uint256)",
  "function childrenOf(uint256 tokenId) external view returns (uint256[])",
  "function remixCount(uint256 tokenId) external view returns (uint256)",
  "function lineageOf(uint256 tokenId) external view returns (uint256[])",
  "function versionLineOf(uint256 tokenId) external view returns (uint256[])",
  "function totalSupply() external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "event SchemeMinted(uint256 indexed tokenId, address indexed creator, uint256 indexed parentId, bytes32 contentHash, uint256 agentId)"
]);

/** SchemeMarket — creator-set price + instant lineage split (no vault, no withdraw). */
export const schemeMarketAbi = parseAbi([
  "function setPrice(uint256 tokenId, uint256 price) external",
  "function applyScheme(uint256 tokenId) external payable returns (uint256 creatorCut, uint256 platformCut)",
  "function splitPreview(uint256 tokenId, uint256 amount) external view returns (uint256 creatorCut, uint256 platformCut, uint256 ancestorPool, address[] ancestors)",
  "function priceOf(uint256 tokenId) external view returns (uint256)",
  "function appliedCount(uint256 tokenId) external view returns (uint256)",
  "function totalApplied() external view returns (uint256)",
  "function platform() external view returns (address)",
  "function scheme() external view returns (address)",
  "event PriceSet(uint256 indexed tokenId, address indexed creator, uint256 price)",
  "event SchemeApplied(uint256 indexed tokenId, address indexed applier, address indexed creator, uint256 price, uint256 creatorCut, uint256 platformCut)",
  "event AncestorPaid(uint256 indexed tokenId, address indexed ancestor, uint256 amount)"
]);

/** AgentRegistry — AI generator registry (Kimi = agentId 1). */
export const agentRegistryAbi = parseAbi([
  "function registerAgent(string calldata metadataURI) external returns (uint256 agentId)",
  "function isRegistered(uint256 agentId) external view returns (bool)",
  "function reputationOf(uint256 agentId) external view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI)",
  "event ReputationAdded(uint256 indexed agentId, uint256 newReputation, uint256 delta)"
]);

/** ProvenanceRegistry — content-commitment attestation (privacy-first). */
export const provenanceRegistryAbi = parseAbi([
  "function attest(bytes32 commitment, uint256 agentId, string calldata metadataURI) external",
  "function verify(bytes32 commitment) external view returns (bool exists, address attestor, uint256 agentId, uint64 attestedAt)",
  "event Attested(address indexed attestor, bytes32 indexed commitment, uint256 indexed agentId, string metadataURI)"
]);

export const schemeMintedEvent = parseAbi([
  "event SchemeMinted(uint256 indexed tokenId, address indexed creator, uint256 indexed parentId, bytes32 contentHash, uint256 agentId)"
])[0];

export const schemeAppliedEvent = parseAbi([
  "event SchemeApplied(uint256 indexed tokenId, address indexed applier, address indexed creator, uint256 price, uint256 creatorCut, uint256 platformCut)"
])[0];

const ASSERTION_COMPONENTS = [
  { name: "authenticatorData", type: "bytes" },
  { name: "clientDataJSON", type: "bytes" },
  { name: "r", type: "uint256" },
  { name: "s", type: "uint256" }
] as const;

/** P256PasskeyAccount — WebAuthn/passkey smart account (gas relayed). */
export const passkeyAccountAbi = [
  { type: "function", name: "nonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "keyCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "rpIdHash", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "originHash", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  {
    type: "function",
    name: "challengePreview",
    stateMutability: "view",
    inputs: [
      { name: "n", type: "uint256" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "dataHash", type: "bytes32" }
    ],
    outputs: [{ type: "bytes32" }]
  },
  {
    type: "function",
    name: "addKey",
    stateMutability: "nonpayable",
    inputs: [
      { name: "x", type: "uint256" },
      { name: "y", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "assertion", type: "tuple", components: ASSERTION_COMPONENTS }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "executeBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address[]" },
      { name: "value", type: "uint256[]" },
      { name: "data", type: "bytes[]" },
      { name: "assertion", type: "tuple", components: ASSERTION_COMPONENTS }
    ],
    outputs: []
  },
  {
    type: "event",
    name: "Executed",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
      { name: "nonceAfter", type: "uint256", indexed: false }
    ]
  },
  { type: "error", name: "InvalidSignature", inputs: [] },
  { type: "error", name: "BadOrigin", inputs: [] }
] as const;

/** PasskeyAccountFactory — CREATE2 deterministic passkey account deployment. */
export const passkeyFactoryAbi = [
  {
    type: "function",
    name: "accountOf",
    stateMutability: "view",
    inputs: [
      { name: "x", type: "uint256" },
      { name: "y", type: "uint256" },
      { name: "rpIdHash", type: "bytes32" },
      { name: "originHash", type: "bytes32" }
    ],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "createAccount",
    stateMutability: "nonpayable",
    inputs: [
      { name: "x", type: "uint256" },
      { name: "y", type: "uint256" },
      { name: "rpIdHash", type: "bytes32" },
      { name: "originHash", type: "bytes32" }
    ],
    outputs: [{ type: "address" }]
  },
  {
    type: "event",
    name: "AccountCreated",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "x", type: "uint256", indexed: false },
      { name: "y", type: "uint256", indexed: false }
    ]
  },
  { type: "error", name: "AccountExists", inputs: [{ name: "account", type: "address" }] }
] as const;
