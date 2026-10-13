/**
  * lib/passkey.ts -- browser-side passkey (WebAuthn + P-256) client.
 *
  * Strictly mirrors the conventions of on-chain P256PasskeyAccount / WebAuthn.sol / PasskeyAccountFactory:
  *   - rpIdHash   = sha256(utf8(rpId))            (contract immutable, written at registration)
  *   - originHash = keccak256(utf8(origin))        (0 means origin is not checked)
 *   · challenge  = keccak256(abi.encodePacked(
 *         "dh/passkey/tx"    | "dh/passkey/batch",
 *         account, chainId, nonce, to, value, keccak256(data)     // single
 *         account, chainId, nonce, keccak256(abi.encode(to,value,dataHashes))  // batch
 *       ))
  *   - the assertion signature covers sha256(authenticatorData ‖ sha256(clientDataJSON)); r/s are the P-256 components.
  *   - account address = PasskeyAccountFactory.accountOf(x, y, rpIdHash, originHash) (CREATE2, counterfactual).
 *
  * No private key, no seed phrase throughout: the private key lives only in the device secure chip (Secure Enclave / StrongBox / TPM).
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
import { L } from "./langStore";

/** Whether the hostname is an IP literal (IPv4 / IPv6). */
export function isIpLiteralHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

/**
  * RP ID: defaults to the current host (localhost when opened via localhost); overridable via env to a real domain.
 *
  * WARNING: the WebAuthn spec requires RP ID to be a **valid domain**, and browsers **reject IP literals** (e.g. 127.0.0.1),
  * throwing "The effective domain of the document is not a valid domain". Local development must use
  * http://localhost:PORT (127.0.0.1 does not work); here an IP falls back to "localhost".
  * In production, specify the real domain via NEXT_PUBLIC_PASSKEY_RP_ID.
 */
export function passkeyRpId(): string {
  const env = process.env.NEXT_PUBLIC_PASSKEY_RP_ID;
  if (env) return env;
  if (typeof window === "undefined") return "localhost";
  const host = window.location.hostname;
  if (isIpLiteralHost(host)) return "localhost";
  return host;
}

/** RP display name. */
export function passkeyRpName(): string {
  return process.env.NEXT_PUBLIC_PASSKEY_RP_NAME || "Designer Hub";
}

/** Origin: defaults to the current site origin (e.g. http://localhost:3005). */
export function passkeyOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_PASSKEY_ORIGIN ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")
  );
}

/** rpIdHash = sha256(rpId), 32 bytes. (viem's sha256 already returns 0x hex.) */
export function rpIdHashHex(rpId: string = passkeyRpId()): Hex {
  return sha256(toBytes(rpId));
}

/** originHash = keccak256(origin), 32 bytes (bytes32(0) means origin is not checked). */
export function originHashHex(origin: string = passkeyOrigin()): Hex {
  return keccak256(toBytes(origin));
}

// ------------------------------------------------------------------ //
//                        base64url / byte utils                         //
// ------------------------------------------------------------------ //

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

// ------------------------------------------------------------------ //
//                        minimal CBOR decoder                          //
// ------------------------------------------------------------------ //

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
    case 2: {
      const b = buf.slice(o, o + len);
      return { value: b, offset: o + len };
    }
    case 3: {
      const b = buf.slice(o, o + len);
      return { value: new TextDecoder().decode(b), offset: o + len };
    }
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
      throw new Error(L(`passkey: 不支持的 CBOR major=${major}`, `passkey: unsupported CBOR major=${major}`));
  }
}

// ------------------------------------------------------------------ //
//                  extract P-256 public key (x, y) from the registration response //
// ------------------------------------------------------------------ //

/** Take coordinates from a 65-byte uncompressed point (0x04‖X‖Y). */
function xyFromRawPoint(point: Uint8Array): { x: Hex; y: Hex } {
  if (point.length < 65 || point[0] !== 0x04) {
    throw new Error(L("passkey: 公钥非压缩 P-256 点", "passkey: public key is not an uncompressed P-256 point"));
  }
  const x = point.slice(point.length - 64, point.length - 32);
  const y = point.slice(point.length - 32);
  return { x: toHex(x), y: toHex(y) };
}

/**
  * Extract the 65-byte uncompressed point (0x04‖X‖Y) from SPKI (SubjectPublicKeyInfo, DER).
 *
  * Note: WebAuthn's `getPublicKey()` returns **SPKI DER** (91 bytes for P-256, first byte 0x30),
  * not the raw point. Its trailing BIT STRING is `0x00 (unused bits) ‖ 0x04‖X‖Y`, so the last 65 bytes are the target point.
  * Treating it as a raw point would fail the check at `point[0] !== 0x04`.
 */
function rawPointFromSpki(spki: Uint8Array): Uint8Array {
  // Canonical path: SPKI ends with a fixed BIT STRING; the last 65 bytes are 0x04‖X‖Y.
  if (spki.length >= 65 && spki[spki.length - 65] === 0x04) {
    return spki.slice(spki.length - 65);
  }
  // Already a raw point (non-standard) or containing extra fields: scan for the first 0x04 marker.
  for (let i = 0; i + 65 <= spki.length; i++) {
    if (spki[i] === 0x04) return spki.slice(i, i + 65);
  }
  throw new Error(L("passkey: 无法从 SPKI 中定位 P-256 非压缩点", "passkey: could not locate the P-256 uncompressed point in SPKI"));
}

/** Parse a COSE_Key (EC2, P-256) from authenticator data -> (x, y). */
function xyFromAuthData(authData: Uint8Array): { x: Hex; y: Hex } {
  if (authData.length < 37) throw new Error(L("passkey: authenticatorData 过短", "passkey: authenticatorData too short"));
  const flags = authData[32];
  if ((flags & 0x40) === 0)
    throw new Error(L("passkey: 注册响应缺少 attested credential data", "passkey: registration response missing attested credential data"));
  let o = 37 + 16; // rpIdHash(32)+flags(1)+signCount(4)+aaguid(16)
  const credIdLen = (authData[o] << 8) | authData[o + 1];
  o += 2 + credIdLen;
  const cose = authData.slice(o);
  const { value } = cborDecode(cose);
  if (!(value instanceof Map)) throw new Error(L("passkey: COSE_Key 解析失败", "passkey: failed to parse COSE_Key"));
  const x = value.get(-2) as Uint8Array | undefined;
  const y = value.get(-3) as Uint8Array | undefined;
  if (!x || !y) throw new Error(L("passkey: COSE_Key 缺少 EC2 坐标 (-2/-3)", "passkey: COSE_Key missing EC2 coordinates (-2/-3)"));
  return { x: toHex(x), y: toHex(y) };
}

/**
  * Retrieve the authData bytes from attestationObject (a CBOR map: { fmt, attStmt, authData }).
 *
  * Note: `resp.attestationObject` is a CBOR wrapper object, **not** raw authData;
  * feeding it directly to `xyFromAuthData` fails to parse due to offset misalignment.
 */
function authDataFromAttestationObject(attestationObject: Uint8Array): Uint8Array {
  try {
    const { value } = cborDecode(attestationObject);
    if (value instanceof Map) {
      const a = value.get("authData");
      if (a instanceof Uint8Array) return a;
    }
  } catch {
    /* fall through to the compatible branch below */
  }
  return attestationObject; // 兼容直接传 authData 的实现
}

// ------------------------------------------------------------------ //
//                       WebAuthn register / assert                     //
// ------------------------------------------------------------------ //

export interface PasskeyCredential {
  credentialId: Uint8Array;
  credentialIdB64: string;
  x: Hex;
  y: Hex;
}

/** Create a passkey (navigator.credentials.create); returns the public-key coordinates and credential id. */
export async function createPasskey(opts?: {
  rpId?: string;
  rpName?: string;
  userName?: string;
  userDisplayName?: string;
}): Promise<PasskeyCredential> {
  if (typeof navigator === "undefined" || !navigator.credentials) {
    throw new Error(L("passkey: 当前环境不支持 WebAuthn", "passkey: WebAuthn is not supported in this environment"));
  }
  const rpId = opts?.rpId ?? passkeyRpId();
  const rpName = opts?.rpName ?? passkeyRpName();
  const userName = opts?.userName ?? `designer-${Date.now()}`;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: rpId, name: rpName },
      user: { id: userId, name: userName, displayName: opts?.userDisplayName ?? userName },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 (P-256)
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      timeout: 60000,
      attestation: "none"
    }
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error(L("passkey: 用户取消或创建失败", "passkey: user canceled or creation failed"));

  const resp = cred.response as AuthenticatorAttestationResponse;
  let xy: { x: Hex; y: Hex } | null = null;
  const spki = (resp as AuthenticatorAttestationResponse & { getPublicKey?: () => ArrayBuffer | null }).getPublicKey?.();
  if (spki && spki.byteLength >= 65) {
    try {
      xy = xyFromRawPoint(rawPointFromSpki(new Uint8Array(spki)));
    } catch {
      xy = null; // 回退到 attestationObject 中的 COSE_Key
    }
  }
  if (!xy) {
    xy = xyFromAuthData(authDataFromAttestationObject(new Uint8Array(resp.attestationObject)));
  }

  const credentialId = new Uint8Array(cred.rawId);
  return { credentialId, credentialIdB64: b64urlEncode(credentialId), ...xy };
}

/** DER (ASN.1) ECDSA signature -> (r, s). */
export function derToRS(der: Uint8Array): { r: bigint; s: bigint } {
  if (der[0] !== 0x30) throw new Error(L("passkey: 签名非 DER SEQUENCE", "passkey: signature is not a DER SEQUENCE"));
  let i = 1;
  if (der[i] & 0x80) i += 1 + (der[i] & 0x7f);
  else i += 1;
  if (der[i] !== 0x02) throw new Error(L("passkey: DER 缺少 r INTEGER", "passkey: DER missing r INTEGER"));
  const rLen = der[i + 1];
  const r = bytesToBigInt(der.slice(i + 2, i + 2 + rLen));
  let j = i + 2 + rLen;
  if (der[j] !== 0x02) throw new Error(L("passkey: DER 缺少 s INTEGER", "passkey: DER missing s INTEGER"));
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

/** Perform a WebAuthn assertion for the given challenge (navigator.credentials.get), returning material directly usable on-chain. */
export async function signAssertion(opts: {
  challenge: Hex;
  rpId?: string;
  credentialId: Uint8Array;
}): Promise<PasskeyAssertion> {
  if (typeof navigator === "undefined" || !navigator.credentials) {
    throw new Error(L("passkey: 当前环境不支持 WebAuthn", "passkey: WebAuthn is not supported in this environment"));
  }
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(hexToBytes(opts.challenge)),
      rpId: opts.rpId ?? passkeyRpId(),
      allowCredentials: [{ type: "public-key", id: new Uint8Array(opts.credentialId) }],
      userVerification: "preferred",
      timeout: 60000
    }
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error(L("passkey: 用户取消或断言失败", "passkey: user canceled or assertion failed"));

  const resp = cred.response as AuthenticatorAssertionResponse;
  const { r, s } = derToRS(new Uint8Array(resp.signature));
  return {
    authenticatorData: toHex(new Uint8Array(resp.authenticatorData)),
    clientDataJSON: toHex(new Uint8Array(resp.clientDataJSON)),
    r,
    s
  };
}

// ------------------------------------------------------------------ //
//                          challenge derivation (mirror)              //
// ------------------------------------------------------------------ //

/** Single: keccak256(abi.encodePacked("dh/passkey/tx", account, chainId, nonce, to, value, keccak256(data))). */
export function deriveSingleChallenge(p: {
  account: Address;
  chainId: bigint;
  nonce: bigint;
  to: Address;
  value: bigint;
  data: Hex;
}): Hex {
  return keccak256(
    encodePacked(
      ["string", "address", "uint256", "uint256", "address", "uint256", "bytes32"],
      ["dh/passkey/tx", p.account, p.chainId, p.nonce, p.to, p.value, keccak256(p.data)]
    )
  );
}

/** Batch: keccak256(abi.encodePacked("dh/passkey/batch", account, chainId, nonce, keccak256(abi.encode(to,value,dataHashes)))). */
export function deriveBatchChallenge(p: {
  account: Address;
  chainId: bigint;
  nonce: bigint;
  to: readonly Address[];
  value: readonly bigint[];
  data: readonly Hex[];
}): Hex {
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
