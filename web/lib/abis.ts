import { parseAbi } from "viem";

/**
  * DreamScheme -- scheme NFT (lineage remix + ERC-2981 royalties + AI Agent attribution).
  * mint/remix carry an agentId (the AI generator, from AgentRegistry); the agentId is assigned by provider
  * (see lib/agents.ts: Kimi=1, Qwen=2, DeepSeek=3 ...), no longer hardcoded to 1.
  * Note: keep the entries minimal -- too many parseAbi entries degrade viem's readContract generic inference to unknown.
  * Unused schemeOf/setRoyalty/RoyaltySet/hashToTokenId/royaltyInfo/supportsInterface are not declared here.
 */
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

/**
  * DreamScheme content-uniqueness guard -- content hash -> minted tokenId (0 = not yet minted).
  * Declared separately: merging into dreamSchemeAbi would add too many entries and degrade viem's generic inference.
 */
export const dreamSchemeDupAbi = parseAbi([
  "function hashToTokenId(bytes32 contentHash) external view returns (uint256)"
]);

/**
  * SchemeMarket -- usage-rights marketplace (creator-set pricing + automatic lineage splits).
  * The old fixed applyPrice + withdraw model was removed: creators now list via setPrice,
  * buyers pay the listed price, and 85/10/5 (derivative) or 90/10 (original) is split in real time.
 */
export const schemeMarketAbi = parseAbi([
  "function setPrice(uint256 tokenId, uint256 price) external",
  "function setPayout(uint256 tokenId, address payout) external",
  "function applyScheme(uint256 tokenId) external payable returns (uint256 creatorCut, uint256 platformCut)",
  "function splitPreview(uint256 tokenId, uint256 amount) external view returns (uint256 creatorCut, uint256 platformCut, uint256 ancestorPool, address[] ancestors)",
  "function priceOf(uint256 tokenId) external view returns (uint256)",
  "function payoutOf(uint256 tokenId) external view returns (address)",
  "function appliedCount(uint256 tokenId) external view returns (uint256)",
  "function totalApplied() external view returns (uint256)",
  "function platform() external view returns (address)",
  "function scheme() external view returns (address)",
  "event PriceSet(uint256 indexed tokenId, address indexed creator, uint256 price)",
  "event PayoutSet(uint256 indexed tokenId, address indexed creator, address payout)",
  "event SchemeApplied(uint256 indexed tokenId, address indexed applier, address indexed creator, uint256 price, uint256 creatorCut, uint256 platformCut)",
  "event AncestorPaid(uint256 indexed tokenId, address indexed ancestor, uint256 amount)"
]);

/** AgentRegistry -- AI generator registry (agentId auto-increments from 1; Kimi is pre-registered as 1). */
export const agentRegistryAbi = parseAbi([
  "function registerAgent(string calldata metadataURI) external returns (uint256 agentId)",
  "function isRegistered(uint256 agentId) external view returns (bool)",
  "function reputationOf(uint256 agentId) external view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI)",
  "event ReputationAdded(uint256 indexed agentId, uint256 newReputation, uint256 delta)"
]);

/** ProvenanceRegistry -- attestation of the scheme generation process (EIP-712 signature + relayer sponsorship). */
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

/** Kimi's pre-registered ID in AgentRegistry (= 1). Defined in lib/agents.ts and re-exported here for backward-compatible imports. */
export { KIMI_AGENT_ID } from "./agents";

// ------------------------------------------------------------------ //
//  Passkey (seedless smart account) -- contains tuple params, so use a JSON ABI   //
//  abitype's parseAbi does not support struct/tuple in human-readable ABIs,     //
//  the assertion param of execute/executeBatch is a struct, so JSON is written directly here. //
// ------------------------------------------------------------------ //

const ASSERTION_COMPONENTS = [
  { name: "authenticatorData", type: "bytes" },
  { name: "clientDataJSON", type: "bytes" },
  { name: "r", type: "uint256" },
  { name: "s", type: "uint256" }
] as const;

/** P256PasskeyAccount -- WebAuthn/passkey smart account (gas sponsored by the relayer). */
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

/** PasskeyAccountFactory -- CREATE2 deterministic deployment of passkey accounts. */
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
