/**
 * passkey.ts — browser-side passkey (WebAuthn + P-256) client.
 *
 * Mirrors the on-chain P256PasskeyAccount / WebAuthn.sol / PasskeyAccountFactory contract:
 *   · rpIdHash   = sha256(utf8(rpId))          (contract immutable, fixed at registration)
 *   · originHash = keccak256(utf8(origin))      (bytes32(0) disables the origin check)
 *   · challenge  = keccak256(abi.encodePacked(
 *         "dh/passkey/tx"    | "dh/passkey/batch",
 *         account, chainId, nonce, to, value, keccak256(data)                       // single
 *         account, chainId, nonce, keccak256(abi.encode(to, value, dataHashes))     // batch
 *       ))
 *   · the assertion signs sha256(authenticatorData ‖ sha256(clientDataJSON)); r/s are P-256 components.
 *   · account address = factory.accountOf(x, y, rpIdHash, originHash)  (CREATE2, counterfactual).
 *
 * No private key, no mnemonic: the key never leaves the device secure element
 * (Secure Enclave / StrongBox / TPM).
 */

import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  sha256,
  toBytes,
  toHex,
  hexToBytes,
  type Address,
  type Hex
} from "viem";

/** rpIdHash = sha256(rpId), 32 bytes. */
export function rpIdHashHex(rpId: string): Hex {
  return sha256(toBytes(rpId));
}

/** originHash = keccak256(origin), 32 bytes (bytes32(0) disables the origin check). */
export function originHashHex(origin: string): Hex {
  return keccak256(toBytes(origin));
}

// ---------------------------------------------------------------- byte utils

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  if (hex === "0x") return 0n;
  return BigInt(hex);
}

// ------------------------------------------------------- minimal CBOR decoder

function cborDecode(buf: Uint8Array, offset = 0): { value: unknown; offset: number } {
  const first = buf[offset];
  const major = first >> 5;
  const info = first & 0x1f;
  let o = offset + 1;
  let len = info;
  if (info === 24) {
    len = buf[o];
    o += 1;
  } else if (info === 25) {
    len = (buf[o] << 8) | buf[o + 1];
    o += 2;
  } else if (info === 26) {
    len = ((buf[o] << 24) >>> 0) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3];
    o += 4;
  } else if (info === 27) {
    let v = 0n;
    for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(buf[o + i]);
    o += 8;
    len = Number(v);
  }

  switch (major) {
    case 0:
      return { value: len, offset: o };
    case 1:
      return { value: -1 - len, offset: o };
    case 2:
      return { value: buf.slice(o, o + len), offset: o + len };
    case 3:
      return { value: new TextDecoder().decode(buf.slice(o, o + len)), offset: o + len };
    case 4: {
      const arr: unknown[] = [];
      for (let i = 0; i < len; i++) {
        const r = cborDecode(buf, o);
        arr.push(r.value);
        o = r.offset;
      }
      return { value: arr, offset: o };
    }
    case 5: {
      const map = new Map<unknown, unknown>();
      for (let i = 0; i < len; i++) {
        const k = cborDecode(buf, o);
        const v = cborDecode(buf, k.offset);
        map.set(k.value, v.value);
        o = v.offset;
      }
      return { value: map, offset: o };
    }
    case 7: {
      if (info === 20) return { value: false, offset: o };
      if (info === 21) return { value: true, offset: o };
      if (info === 22) return { value: null, offset: o };
      return { value: len, offset: o };
    }
    default:
      throw new Error(`passkey: unsupported CBOR major=${major}`);
  }
}

/** From a 65-byte uncompressed point (0x04‖X‖Y) read the coordinates. */
function xyFromRawPoint(point: Uint8Array): { x: Hex; y: Hex } {
  if (point.length < 65 || point[0] !== 0x04) {
    throw new Error("passkey: public key is not an uncompressed P-256 point");
  }
  const x = point.slice(point.length - 64, point.length - 32);
  const y = point.slice(point.length - 32);
  return { x: toHex(x), y: toHex(y) };
}

/** Parse COSE_Key (EC2, P-256) from authenticatorData → (x, y). */
function xyFromAuthData(authData: Uint8Array): { x: Hex; y: Hex } {
  if (authData.length < 37) throw new Error("passkey: authenticatorData too short");
  const flags = authData[32];
  if ((flags & 0x40) === 0) throw new Error("passkey: registration response lacks attested credential data");
  let o = 37 + 16; // rpIdHash(32)+flags(1)+signCount(4)+aaguid(16)
  const credIdLen = (authData[o] << 8) | authData[o + 1];
  o += 2 + credIdLen;
  const { value } = cborDecode(authData.slice(o));
  if (!(value instanceof Map)) throw new Error("passkey: COSE_Key parse failed");
  const x = value.get(-2) as Uint8Array | undefined;
  const y = value.get(-3) as Uint8Array | undefined;
  if (!x || !y) throw new Error("passkey: COSE_Key missing EC2 coordinates (-2/-3)");
  return { x: toHex(x), y: toHex(y) };
}

// ---------------------------------------------------------- WebAuthn create/get

export interface PasskeyCredential {
  credentialId: Uint8Array;
  credentialIdB64: string;
  x: Hex;
  y: Hex;
}

/** Create a passkey (navigator.credentials.create) and return its public key + credential id. */
export async function createPasskey(opts: {
  rpId: string;
  rpName?: string;
  userName?: string;
  userDisplayName?: string;
}): Promise<PasskeyCredential> {
  if (typeof navigator === "undefined" || !navigator.credentials) {
    throw new Error("passkey: WebAuthn is not available in this environment");
  }
  const rpName = opts.rpName ?? "Designer Hub";
  const userName = opts.userName ?? `designer-${Date.now()}`;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: opts.rpId, name: rpName },
      user: { id: userId, name: userName, displayName: opts.userDisplayName ?? userName },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 (P-256)
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      timeout: 60000,
      attestation: "none"
    }
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("passkey: cancelled or creation failed");

  const resp = cred.response as AuthenticatorAttestationResponse;
  let xy: { x: Hex; y: Hex };
  const spki = (resp as AuthenticatorAttestationResponse & { getPublicKey?: () => ArrayBuffer | null }).getPublicKey?.();
  if (spki && spki.byteLength >= 65) {
    xy = xyFromRawPoint(new Uint8Array(spki));
  } else {
    xy = xyFromAuthData(new Uint8Array(resp.attestationObject));
  }

  const credentialId = new Uint8Array(cred.rawId);
  return { credentialId, credentialIdB64: b64urlEncode(credentialId), ...xy };
}

/** DER (ASN.1) ECDSA signature → (r, s). */
export function derToRS(der: Uint8Array): { r: bigint; s: bigint } {
  if (der[0] !== 0x30) throw new Error("passkey: signature is not a DER SEQUENCE");
  let i = 1;
  if (der[i] & 0x80) i += 1 + (der[i] & 0x7f);
  else i += 1;
  if (der[i] !== 0x02) throw new Error("passkey: DER missing r INTEGER");
  const rLen = der[i + 1];
  const r = bytesToBigInt(der.slice(i + 2, i + 2 + rLen));
  const j = i + 2 + rLen;
  if (der[j] !== 0x02) throw new Error("passkey: DER missing s INTEGER");
  const sLen = der[j + 1];
  const s = bytesToBigInt(der.slice(j + 2, j + 2 + sLen));
  return { r, s };
}

export interface PasskeyAssertion {
  authenticatorData: Hex;
  clientDataJSON: Hex;
  r: bigint;
  s: bigint;
}

/** Sign a challenge with the passkey (navigator.credentials.get) → on-chain-ready assertion. */
export async function signAssertion(opts: {
  challenge: Hex;
  rpId: string;
  credentialId: Uint8Array;
}): Promise<PasskeyAssertion> {
  if (typeof navigator === "undefined" || !navigator.credentials) {
    throw new Error("passkey: WebAuthn is not available in this environment");
  }
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(hexToBytes(opts.challenge)),
      rpId: opts.rpId,
      allowCredentials: [{ type: "public-key", id: new Uint8Array(opts.credentialId) }],
      userVerification: "preferred",
      timeout: 60000
    }
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("passkey: cancelled or assertion failed");

  const resp = cred.response as AuthenticatorAssertionResponse;
  const { r, s } = derToRS(new Uint8Array(resp.signature));
  return {
    authenticatorData: toHex(new Uint8Array(resp.authenticatorData)),
    clientDataJSON: toHex(new Uint8Array(resp.clientDataJSON)),
    r,
    s
  };
}

// --------------------------------------------------------- challenge derivation

export interface SingleChallengeParams {
  account: Address;
  chainId: bigint;
  nonce: bigint;
  to: Address;
  value: bigint;
  data: Hex;
}

/** keccak256(abi.encodePacked("dh/passkey/tx", account, chainId, nonce, to, value, keccak256(data))). */
export function deriveSingleChallenge(p: SingleChallengeParams): Hex {
  return keccak256(
    encodePacked(
      ["string", "address", "uint256", "uint256", "address", "uint256", "bytes32"],
      ["dh/passkey/tx", p.account, p.chainId, p.nonce, p.to, p.value, keccak256(p.data)]
    )
  );
}

export interface BatchChallengeParams {
  account: Address;
  chainId: bigint;
  nonce: bigint;
  to: readonly Address[];
  value: readonly bigint[];
  data: readonly Hex[];
}

/** keccak256(abi.encodePacked("dh/passkey/batch", account, chainId, nonce, keccak256(abi.encode(to, value, dataHashes)))). */
export function deriveBatchChallenge(p: BatchChallengeParams): Hex {
  const dataHashes = p.data.map((d) => keccak256(d));
  const batchHash = keccak256(
    encodeAbiParameters(
      [{ type: "address[]" }, { type: "uint256[]" }, { type: "bytes32[]" }],
      [p.to as Address[], p.value as bigint[], dataHashes]
    )
  );
  return keccak256(
    encodePacked(
      ["string", "address", "uint256", "uint256", "bytes32"],
      ["dh/passkey/batch", p.account, p.chainId, p.nonce, batchHash]
    )
  );
}
