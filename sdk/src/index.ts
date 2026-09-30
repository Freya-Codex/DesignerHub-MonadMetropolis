/**
 * @yunzhujia/sdk — typed client for the Designer Hub on-chain primitive (Monad).
 *
 *   import {
 *     monadTestnet, publicClient, readScheme,
 *     buildMintData, deriveSingleChallenge,
 *     rpIdHashHex, originHashHex, createPasskey, signAssertion, passkeyFactoryAbi
 *   } from "@yunzhujia/sdk";
 *
 * Primitives covered:
 *   · passkey (WebAuthn / P-256) smart accounts — no mnemonic, key stays in the secure element
 *   · provenance attestation — commit content on-chain without revealing it
 *   · remixable scheme assets — lineage + instant revenue split
 */

export * from "./addresses.js";
export * from "./abi.js";
export * from "./passkey.js";
export * from "./actions.js";

/** Package version. */
export const SDK_VERSION = "0.1.0";
