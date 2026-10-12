/**
 * lib/passkey.ts —— 浏览器侧 passkey（WebAuthn + P-256）客户端。
 *
 * 严格镜像链上 P256PasskeyAccount / WebAuthn.sol / PasskeyAccountFactory 的约定：
 *   · rpIdHash   = sha256(utf8(rpId))            （合约 immutable，注册时写入）
 *   · originHash = keccak256(utf8(origin))        （0 表示不校验 origin）
 *   · challenge  = keccak256(abi.encodePacked(
 *         "dh/passkey/tx"    | "dh/passkey/batch",
 *         account, chainId, nonce, to, value, keccak256(data)     // single
 *         account, chainId, nonce, keccak256(abi.encode(to,value,dataHashes))  // batch
 *       ))
 *   · 断言签名覆盖 sha256(authenticatorData ‖ sha256(clientDataJSON))，r/s 为 P-256 分量。
 *   · 账户地址 = PasskeyAccountFactory.accountOf(x, y, rpIdHash, originHash)（CREATE2，counterfactual）。
 *
 * 全程无私钥、无助记词：私钥只存在于设备安全芯片（Secure Enclave / StrongBox / TPM）。
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

/** 判断主机名是否为 IP 字面量（IPv4 / IPv6）。 */
export function isIpLiteralHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

/**
 * RP ID：默认取当前访问域名（localhost 打开即 "localhost"）；可用 env 覆盖为正式域名。
 *
 * ⚠️ WebAuthn 规范要求 RP ID 必须是**合法域名**，浏览器会**直接拒绝 IP 字面量**（如 127.0.0.1），
 * 报错 "The effective domain of the document is not a valid domain"。本地开发必须用
 * http://localhost:PORT 访问（127.0.0.1 不行）；此处对 IP 兜底为 "localhost"。
 * 生产环境请用 NEXT_PUBLIC_PASSKEY_RP_ID 指定正式域名。
 */
export function passkeyRpId(): string {
  const env = process.env.NEXT_PUBLIC_PASSKEY_RP_ID;
  if (env) return env;
  if (typeof window === "undefined") return "localhost";
  const host = window.location.hostname;
  if (isIpLiteralHost(host)) return "localhost";
  return host;
}

/** RP 展示名。 */
export function passkeyRpName(): string {
  return process.env.NEXT_PUBLIC_PASSKEY_RP_NAME || "Designer Hub";
}

/** Origin：默认取当前站点 origin（如 http://localhost:3005）。 */
export function passkeyOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_PASSKEY_ORIGIN ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")
  );
}

/** rpIdHash = sha256(rpId)，32 字节。（viem 的 sha256 已返回 0x Hex。） */
export function rpIdHashHex(rpId: string = passkeyRpId()): Hex {
  return sha256(toBytes(rpId));
}

/** originHash = keccak256(origin)，32 字节（bytes32(0) 表示不校验 origin）。 */
export function originHashHex(origin: string = passkeyOrigin()): Hex {
  return keccak256(toBytes(origin));
}

// ------------------------------------------------------------------ //
//                        base64url / 字节工具                         //
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
//                        最小 CBOR 解码器                             //
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
//                  从注册响应提取 P-256 公钥 (x, y)                    //
// ------------------------------------------------------------------ //

/** 从 65 字节非压缩点（0x04‖X‖Y）取坐标。 */
function xyFromRawPoint(point: Uint8Array): { x: Hex; y: Hex } {
  if (point.length < 65 || point[0] !== 0x04) {
    throw new Error(L("passkey: 公钥非压缩 P-256 点", "passkey: public key is not an uncompressed P-256 point"));
  }
  const x = point.slice(point.length - 64, point.length - 32);
  const y = point.slice(point.length - 32);
  return { x: toHex(x), y: toHex(y) };
}

/**
 * 从 SPKI（SubjectPublicKeyInfo，DER）中取出 65 字节非压缩点（0x04‖X‖Y）。
 *
 * 注意：WebAuthn 的 `getPublicKey()` 返回的是 **SPKI DER**（P-256 为 91 字节，首字节 0x30），
 * 而不是原始点。其尾部 BIT STRING 为 `0x00（未用位数）‖ 0x04‖X‖Y`，因此最后 65 字节即目标点。
 * 直接把它当原始点校验会在 `point[0] !== 0x04` 处误判失败。
 */
function rawPointFromSpki(spki: Uint8Array): Uint8Array {
  // 规范路径：SPKI 末尾固定为 BIT STRING，最后 65 字节即 0x04‖X‖Y。
  if (spki.length >= 65 && spki[spki.length - 65] === 0x04) {
    return spki.slice(spki.length - 65);
  }
  // 已是原始点（非标准实现）或含额外字段：扫描首个 0x04 标记。
  for (let i = 0; i + 65 <= spki.length; i++) {
    if (spki[i] === 0x04) return spki.slice(i, i + 65);
  }
  throw new Error(L("passkey: 无法从 SPKI 中定位 P-256 非压缩点", "passkey: could not locate the P-256 uncompressed point in SPKI"));
}

/** 从认证器数据中解析 COSE_Key（EC2, P-256）→ (x, y)。 */
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
 * 从 attestationObject（CBOR map：{ fmt, attStmt, authData }）中取回 authData 字节。
 *
 * 注意：`resp.attestationObject` 是 CBOR 包装对象，**不是**裸 authData；
 * 直接送入 `xyFromAuthData` 会因偏移错位而解析失败。
 */
function authDataFromAttestationObject(attestationObject: Uint8Array): Uint8Array {
  try {
    const { value } = cborDecode(attestationObject);
    if (value instanceof Map) {
      const a = value.get("authData");
      if (a instanceof Uint8Array) return a;
    }
  } catch {
    /* 落到下面的兼容分支 */
  }
  return attestationObject; // 兼容直接传 authData 的实现
}

// ------------------------------------------------------------------ //
//                       WebAuthn 注册 / 断言                          //
// ------------------------------------------------------------------ //

export interface PasskeyCredential {
  credentialId: Uint8Array;
  credentialIdB64: string;
  x: Hex;
  y: Hex;
}

/** 创建 passkey（navigator.credentials.create），返回公钥坐标与凭证 id。 */
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
  if (!cred) throw new Error(L("passkey: 用户取消或创建失败", "passkey: user cancelled or creation failed"));

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

/** DER (ASN.1) ECDSA 签名 → (r, s)。 */
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

/** 对给定挑战发起 WebAuthn 断言（navigator.credentials.get），返回链上可直接使用的材料。 */
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
  if (!cred) throw new Error(L("passkey: 用户取消或断言失败", "passkey: user cancelled or assertion failed"));

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
//                          挑战派生（镜像）                            //
// ------------------------------------------------------------------ //

/** 单笔：keccak256(abi.encodePacked("dh/passkey/tx", account, chainId, nonce, to, value, keccak256(data)))。 */
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

/** 批量：keccak256(abi.encodePacked("dh/passkey/batch", account, chainId, nonce, keccak256(abi.encode(to,value,dataHashes))))。 */
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
