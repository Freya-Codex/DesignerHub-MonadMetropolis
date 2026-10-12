import { parseAbi } from "viem";

/**
 * DreamScheme —— 方案 NFT（谱系 remix + ERC-2981 版税 + AI Agent 署名）。
 * mint/remix 均携带 agentId（AI 生成器，如 Kimi = 1，来自 AgentRegistry）。
 * 注意：条目需精简——parseAbi 条目过多会让 viem 的 readContract 泛型推断退化成 unknown。
 * 未用到的 schemeOf/setRoyalty/RoyaltySet/hashToTokenId/royaltyInfo/supportsInterface 不在此处声明。
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
 * DreamScheme 内容唯一性守卫 —— 内容哈希 → 已铸造的 tokenId（0 = 尚未铸造）。
 * 单独声明：并入 dreamSchemeAbi 会让条目数过多，导致 viem 泛型推断退化。
 */
export const dreamSchemeDupAbi = parseAbi([
  "function hashToTokenId(bytes32 contentHash) external view returns (uint256)"
]);

/**
 * SchemeMarket —— 使用权交易市场（创作者自主定价 + 谱系自动分账）。
 * 旧版固定 applyPrice + withdraw 提现模式已移除：现在创作者 setPrice 上架，
 * 买家按定价支付，85/10/5（衍生）或 90/10（原创）实时分账到账。
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

/** AgentRegistry —— AI 生成器注册表（Kimi 预注册为 agentId 1）。 */
export const agentRegistryAbi = parseAbi([
  "function registerAgent(string calldata metadataURI) external returns (uint256 agentId)",
  "function isRegistered(uint256 agentId) external view returns (bool)",
  "function reputationOf(uint256 agentId) external view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI)",
  "event ReputationAdded(uint256 indexed agentId, uint256 newReputation, uint256 delta)"
]);

/** ProvenanceRegistry —— 方案生成过程存证（EIP-712 签名 + relayer 代付）。 */
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

/** Kimi 在 AgentRegistry 的预注册 ID（部署脚本固定为 1）。 */
export const KIMI_AGENT_ID = 1n;

// ------------------------------------------------------------------ //
//  Passkey（无助记词智能账户）—— 含 tuple 形参，用 JSON ABI            //
//  abitype 的 parseAbi 不支持 human-readable 里的 struct/tuple，        //
//  execute/executeBatch 的 assertion 形参是 struct，故此处直接写 JSON。 //
// ------------------------------------------------------------------ //

const ASSERTION_COMPONENTS = [
  { name: "authenticatorData", type: "bytes" },
  { name: "clientDataJSON", type: "bytes" },
  { name: "r", type: "uint256" },
  { name: "s", type: "uint256" }
] as const;

/** P256PasskeyAccount —— WebAuthn/passkey 智能账户（免 gas 由 relayer 代付）。 */
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

/** PasskeyAccountFactory —— CREATE2 确定性部署 passkey 账户。 */
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
