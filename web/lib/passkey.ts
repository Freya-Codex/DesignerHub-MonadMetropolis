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

/** RP ID：默认取当前访问域名（localhost 打开即 "localhost"）；可用 env 覆盖为正式域名。 */
export function passkeyRpId(): string {
  return (
    process.env.NEXT_PUBLIC_PASSKEY_RP_ID ||
    (typeof window !== "undefined" ? window.location.hostname : "localhost")
  );
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
      throw new Error(`passkey: 不支持的 CBOR major=${major}`);
  }
}

// ------------------------------------------------------------------ //
//                  从注册响应提取 P-256 公钥 (x, y)                    //
// ------------------------------------------------------------------ //

/** 从 65 字节非压缩点（0x04‖X‖Y）取坐标。 */
function xyFromRawPoint(point: Uint8Array): { x: Hex; y: Hex } {
  if (point.length < 65 || point[0] !== 0x04) {
    throw new Error("passkey: 公钥非非压缩 P-256 点");
  }
  const x = point.slice(point.length - 64, point.length - 32);
  const y = point.slice(point.length - 32);
  return { x: toHex(x), y: toHex(y) };
}

/** 从认证器数据中解析 COSE_Key（EC2, P-256）→ (x, y)。 */
function xyFromAuthData(authData: Uint8Array): { x: Hex; y: Hex } {
  if (authData.length < 37) throw new Error("passkey: authenticatorData 过短");
  const flags = authData[32];
  if ((flags & 0x40) === 0) throw new Error("passkey: 注册响应缺少 attested credential data");
  let o = 37 + 16; // rpIdHash(32)+flags(1)+signCount(4)+aaguid(16)
  const credIdLen = (authData[o] << 8) | authData[o + 1];
  o += 2 + credIdLen;
  const cose = authData.slice(o);
  const { value } = cborDecode(cose);
  if (!(value instanceof Map)) throw new Error("passkey: COSE_Key 解析失败");
  const x = value.get(-2) as Uint8Array | undefined;
  const y = value.get(-3) as Uint8Array | undefined;
  if (!x || !y) throw new Error("passkey: COSE_Key 缺少 EC2 坐标 (-2/-3)");
  return { x: toHex(x), y: toHex(y) };
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
    throw new Error("passkey: 当前环境不支持 WebAuthn");
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
  if (!cred) throw new Error("passkey: 用户取消或创建失败");

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

/** DER (ASN.1) ECDSA 签名 → (r, s)。 */
export function derToRS(der: Uint8Array): { r: bigint; s: bigint } {
  if (der[0] !== 0x30) throw new Error("passkey: 签名非 DER SEQUENCE");
  let i = 1;
  if (der[i] & 0x80) i += 1 + (der[i] & 0x7f);
  else i += 1;
  if (der[i] !== 0x02) throw new Error("passkey: DER 缺少 r INTEGER");
  const rLen = der[i + 1];
  const r = bytesToBigInt(der.slice(i + 2, i + 2 + rLen));
  let j = i + 2 + rLen;
  if (der[j] !== 0x02) throw new Error("passkey: DER 缺少 s INTEGER");
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
    throw new Error("passkey: 当前环境不支持 WebAuthn");
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
  if (!cred) throw new Error("passkey: 用户取消或断言失败");

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
