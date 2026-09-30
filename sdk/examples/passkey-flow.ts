/**
 * Example: passkey (WebAuthn) smart-account flow — browser only.
 *
 * No mnemonic, no extension, no MON needed: the passkey lives in the device secure
 * element, and a relayer can submit the transaction because the signature binds the
 * exact calldata. Replace the relayer POST with any gas sponsor you control.
 */

import {
  buildAttestData,
  deriveSingleChallenge,
  originHashHex,
  passkeyFactoryAbi,
  publicClient,
  rpIdHashHex,
  monadTestnet,
  KIMI_AGENT_ID,
  createPasskey,
  signAssertion
} from "../src/index.js";
import { encodeFunctionData, keccak256, toHex } from "viem";

const RP_ID = "designerhub.xyz"; // must match the site's registrable domain
const ORIGIN = "https://designerhub.xyz";

export async function flow() {
  const client = publicClient();

  // 1. create the passkey (Face ID / Touch ID / Windows Hello)
  const cred = await createPasskey({ rpId: RP_ID, rpName: "Designer Hub" });

  // 2. derive the deterministic (counterfactual) account address
  const rpIdHash = rpIdHashHex(RP_ID);
  const originHash = originHashHex(ORIGIN);
  const account = await client.readContract({
    address: monadTestnet.passkeyAccountFactory,
    abi: passkeyFactoryAbi,
    functionName: "accountOf",
    args: [BigInt(cred.x), BigInt(cred.y), rpIdHash, originHash]
  });

  // 3. deploy it (a relayer can pay gas; here we just show the call shape)
  const deployData = encodeFunctionData({
    abi: passkeyFactoryAbi,
    functionName: "createAccount",
    args: [BigInt(cred.x), BigInt(cred.y), rpIdHash, originHash]
  });
  console.log("deploy via relayer:", { to: monadTestnet.passkeyAccountFactory, data: deployData });

  // 4. attest a content commitment as the passkey account (ProvenanceRegistry, agentId = Kimi)
  const commitment = keccak256(toHex(`scheme-${Date.now()}`));
  const innerData = buildAttestData(commitment, KIMI_AGENT_ID);
  const nonce = 0n; // read account nonce right before building the challenge
  const challenge = deriveSingleChallenge({
    account,
    chainId: 10143n,
    nonce,
    to: monadTestnet.provenanceRegistry,
    value: 0n,
    data: innerData
  });

  // 5. sign the challenge with the passkey, then hand `assertion` to the relayer
  const assertion = await signAssertion({ challenge, rpId: RP_ID, credentialId: cred.credentialId });
  console.log("submit to relayer:", { op: "execute", account, to: monadTestnet.provenanceRegistry, data: innerData, assertion });
}
