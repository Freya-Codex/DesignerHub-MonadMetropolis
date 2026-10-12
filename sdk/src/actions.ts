/**
 * actions.ts — typed read/write helpers over the Designer Hub contracts.
 *
 * The low-level `build*Data` functions are pure calldata builders (no client needed),
 * so they also work for passkey accounts, where the transaction is submitted through
 * `P256PasskeyAccount.execute(to, value, data, assertion)` rather than directly.
 */

import {
  concat,
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";
import {
  dreamSchemeAbi,
  passkeyAccountAbi,
  provenanceRegistryAbi,
  schemeMarketAbi
} from "./abi.js";
import {
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_EXPLORER,
  MONAD_TESTNET_RPC,
  monadTestnet,
  type ContractAddresses
} from "./addresses.js";

/** Monad Testnet chain definition (for viem clients). */
export const monadTestnetChain = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MONAD", symbol: "MONAD", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_TESTNET_RPC] } },
  blockExplorers: { default: { name: "MonadExplorer", url: MONAD_TESTNET_EXPLORER } },
  testnet: true
});

/** Create a read-only client for Monad Testnet (or a custom RPC). */
export function publicClient(rpcUrl: string = MONAD_TESTNET_RPC): PublicClient {
  return createPublicClient({ chain: monadTestnetChain, transport: http(rpcUrl) });
}

// ----------------------------------------------------------- calldata builders

/** `DreamScheme.mint(parentId, contentHash, agentId, metadataURI)` — original: parentId = 0. */
export function buildMintData(
  parentId: bigint,
  contentHash: Hex,
  agentId: bigint,
  metadataURI: string
): Hex {
  return encodeFunctionData({
    abi: dreamSchemeAbi,
    functionName: "mint",
    args: [parentId, contentHash, agentId, metadataURI]
  });
}

/** `DreamScheme.remix(parentId, contentHash, agentId, metadataURI)` — derivative: parentId > 0. */
export function buildRemixData(
  parentId: bigint,
  contentHash: Hex,
  agentId: bigint,
  metadataURI: string
): Hex {
  return encodeFunctionData({
    abi: dreamSchemeAbi,
    functionName: "remix",
    args: [parentId, contentHash, agentId, metadataURI]
  });
}

/** `SchemeMarket.setPrice(tokenId, price)` — creator sets their own price (wei). */
export function buildSetPriceData(tokenId: bigint, priceWei: bigint): Hex {
  return encodeFunctionData({ abi: schemeMarketAbi, functionName: "setPrice", args: [tokenId, priceWei] });
}

/** `SchemeMarket.applyScheme(tokenId)` calldata (payable — `value` = priceOf(tokenId)). */
export function buildApplySchemeData(tokenId: bigint): Hex {
  return encodeFunctionData({ abi: schemeMarketAbi, functionName: "applyScheme", args: [tokenId] });
}

/** `ProvenanceRegistry.attest(commitment, agentId, metadataURI)` — commit content without revealing it. */
export function buildAttestData(commitment: Hex, agentId: bigint, metadataURI = ""): Hex {
  return encodeFunctionData({
    abi: provenanceRegistryAbi,
    functionName: "attest",
    args: [commitment, agentId, metadataURI]
  });
}

/** `P256PasskeyAccount.addKey(x, y)` — add a second device key (max 4 per account). */
export function buildAddKeyData(x: bigint, y: bigint): Hex {
  return encodeFunctionData({ abi: passkeyAccountAbi, functionName: "addKey", args: [x, y] });
}

/** `P256PasskeyAccount.execute(to, value, data, assertion)` calldata. */
export function buildExecuteData(
  to: Address,
  value: bigint,
  data: Hex,
  assertion: { authenticatorData: Hex; clientDataJSON: Hex; r: bigint; s: bigint }
): Hex {
  return encodeFunctionData({
    abi: passkeyAccountAbi,
    functionName: "execute",
    args: [to, value, data, assertion]
  });
}

/** commitment = keccak256(contentHash ‖ salt) — the salt is a per-attestation secret (e.g. random 32 bytes). */
export function buildCommitment(contentHash: Hex, salt: Hex): Hex {
  return keccak256(concat([contentHash, salt]));
}

// -------------------------------------------------------------- read helpers

export interface SchemeView {
  tokenId: bigint;
  creator: Address;
  parentId: bigint;
  contentHash: Hex;
  agentId: bigint;
  createdAt: bigint;
  remixCount: bigint;
  appliedCount: bigint;
  priceWei: bigint;
  metadataURI: string;
}

/** Read a scheme's on-chain state. Reads are paced sequentially by default to stay under
 *  Monad's public-RPC limit (15 req/s); pass `{ paceMs: 0 }` to fire them in parallel on a private RPC. */
export async function readScheme(
  client: PublicClient,
  tokenId: bigint,
  addr: ContractAddresses = monadTestnet,
  opts: { paceMs?: number } = {}
): Promise<SchemeView> {
  const scheme = addr.dreamScheme;
  const market = addr.schemeMarket;
  const paceMs = opts.paceMs ?? 80;
  const read = <T>(fn: () => Promise<T>, i: number): Promise<T> =>
    paceMs > 0 && i > 0 ? new Promise<T>((res, rej) => setTimeout(() => fn().then(res, rej), i * paceMs)) : fn();
  const [creator, parentId, contentHash, agentId, createdAt, remixCount, metadataURI, appliedCount, priceWei] =
    await Promise.all([
      read(() => client.readContract({ address: scheme, abi: dreamSchemeAbi, functionName: "creatorOf", args: [tokenId] }), 0),
      read(() => client.readContract({ address: scheme, abi: dreamSchemeAbi, functionName: "parentOf", args: [tokenId] }), 1),
      read(() => client.readContract({ address: scheme, abi: dreamSchemeAbi, functionName: "contentHashOf", args: [tokenId] }), 2),
      read(() => client.readContract({ address: scheme, abi: dreamSchemeAbi, functionName: "agentIdOf", args: [tokenId] }), 3),
      read(() => client.readContract({ address: scheme, abi: dreamSchemeAbi, functionName: "createdAtOf", args: [tokenId] }), 4),
      read(() => client.readContract({ address: scheme, abi: dreamSchemeAbi, functionName: "remixCount", args: [tokenId] }), 5),
      read(() => client.readContract({ address: scheme, abi: dreamSchemeAbi, functionName: "tokenURI", args: [tokenId] }), 6),
      read(() => client.readContract({ address: market, abi: schemeMarketAbi, functionName: "appliedCount", args: [tokenId] }), 7),
      read(() => client.readContract({ address: market, abi: schemeMarketAbi, functionName: "priceOf", args: [tokenId] }), 8)
    ]);
  return {
    tokenId,
    creator,
    parentId,
    contentHash,
    agentId,
    createdAt,
    remixCount,
    metadataURI,
    appliedCount,
    priceWei
  };
}

/** Dry-run the instant split for a given amount. */
export async function readSplitPreview(
  client: PublicClient,
  tokenId: bigint,
  amountWei: bigint,
  addr: ContractAddresses = monadTestnet
): Promise<{ creatorCut: bigint; platformCut: bigint; ancestorPool: bigint; ancestors: readonly Address[] }> {
  const [creatorCut, platformCut, ancestorPool, ancestors] = await client.readContract({
    address: addr.schemeMarket,
    abi: schemeMarketAbi,
    functionName: "splitPreview",
    args: [tokenId, amountWei]
  });
  return { creatorCut, platformCut, ancestorPool, ancestors };
}

/** Total number of schemes minted (gallery enumeration does not rely on logs). */
export async function readTotalSupply(
  client: PublicClient,
  addr: ContractAddresses = monadTestnet
): Promise<bigint> {
  return client.readContract({ address: addr.dreamScheme, abi: dreamSchemeAbi, functionName: "totalSupply" });
}

/** Verify a provenance commitment. */
export async function verifyProvenance(
  client: PublicClient,
  commitment: Hex,
  addr: ContractAddresses = monadTestnet
): Promise<{ exists: boolean; attestor: Address; agentId: bigint; attestedAt: bigint }> {
  const [exists, attestor, agentId, attestedAt] = await client.readContract({
    address: addr.provenanceRegistry,
    abi: provenanceRegistryAbi,
    functionName: "verify",
    args: [commitment]
  });
  return { exists, attestor, agentId, attestedAt };
}

/** Read a passkey account's current nonce (must be fresh when building a challenge). */
export async function readAccountNonce(
  client: PublicClient,
  account: Address
): Promise<bigint> {
  return client.readContract({ address: account, abi: passkeyAccountAbi, functionName: "nonce" });
}

// ------------------------------------------------------------- write helpers

/** Write a scheme (mint original or remix) with a user wallet client. */
export async function mintScheme(
  wallet: WalletClient,
  args: { parentId: bigint; contentHash: Hex; agentId: bigint; metadataURI: string; value?: bigint },
  addr: ContractAddresses = monadTestnet
): Promise<Hex> {
  const account = wallet.account;
  if (!account) throw new Error("mintScheme: wallet has no account");
  const data =
    args.parentId === 0n
      ? buildMintData(args.parentId, args.contentHash, args.agentId, args.metadataURI)
      : buildRemixData(args.parentId, args.contentHash, args.agentId, args.metadataURI);
  return wallet.sendTransaction({ account, chain: wallet.chain, to: addr.dreamScheme, data });
}

/** Set a scheme's price (creator only). */
export async function setSchemePrice(
  wallet: WalletClient,
  tokenId: bigint,
  priceWei: bigint,
  addr: ContractAddresses = monadTestnet
): Promise<Hex> {
  const account = wallet.account;
  if (!account) throw new Error("setSchemePrice: wallet has no account");
  return wallet.sendTransaction({
    account,
    chain: wallet.chain,
    to: addr.schemeMarket,
    data: buildSetPriceData(tokenId, priceWei)
  });
}

/** Apply a scheme ("apply to my home") — payable; instant split to creator/platform/ancestors. */
export async function applyScheme(
  wallet: WalletClient,
  tokenId: bigint,
  priceWei: bigint,
  addr: ContractAddresses = monadTestnet
): Promise<Hex> {
  const account = wallet.account;
  if (!account) throw new Error("applyScheme: wallet has no account");
  return wallet.sendTransaction({
    account,
    chain: wallet.chain,
    to: addr.schemeMarket,
    data: buildApplySchemeData(tokenId),
    value: priceWei
  });
}
