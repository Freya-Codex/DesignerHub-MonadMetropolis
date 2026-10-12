/**
 * Deployed contract addresses — Monad Testnet (chainId 10143).
 *
 * These are the canonical addresses of the current five-contract suite. They are
 * duplicated from `contracts/deployments/monad-testnet.json` so the SDK is usable
 * without the repo; regenerate after a redeploy via `npm run build` in this package.
 *
 * The previous deployment (fixed 0.01 MON price + platform vault) is DEPRECATED and
 * intentionally not exported here — see the repo README "Historical deployments".
 */

import type { Address } from "viem";

export const MONAD_TESTNET_CHAIN_ID = 10143 as const;
export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz" as const;
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com" as const;

export interface ContractAddresses {
  dreamScheme: Address;
  schemeMarket: Address;
  agentRegistry: Address;
  provenanceRegistry: Address;
  passkeyAccountFactory: Address;
  /** Receiver of the platform share (10%). */
  platform: Address;
}

/** Current deployment on Monad Testnet. */
export const monadTestnet: ContractAddresses = {
  dreamScheme: "0x2541eB7A4AC7bb5287A5944452576f983b3dc3eB",
  schemeMarket: "0x51DBCb43D2279e7d108753490794f97AA43877a9",
  agentRegistry: "0x9EB3d5C336c66823577F4FBB1E31dbABcf7c268D",
  provenanceRegistry: "0xCe41D2fa11fC3944662b783ac895D3380B8B09ED",
  passkeyAccountFactory: "0x41E72cc140b30891b34Da45f3ed55a525c758C76",
  platform: "0x33DD409d85115E300B4570EeB6D4DA7eF1605D08"
} as const;

/**
 * @deprecated Previous deployment (fixed 0.01 MON apply price + platform vault with
 * `withdraw()`). No on-chain data was migrated; kept only for provenance lookup.
 */
export const monadTestnetV1 = {
  virtuHomeScheme: "0xE04077c0FfFEce593Bf7bB87F009EB7E3ced3137" as Address,
  schemeMarket: "0x1E2f4a8c70371A27f6232c9806aa8b85Ce705513" as Address,
  deployBlock: 65618721 as const
} as const;

/** Kimi is pre-registered in AgentRegistry with this id by the deploy script. */
export const KIMI_AGENT_ID = 1n;
