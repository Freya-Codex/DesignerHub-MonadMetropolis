/**
 * verify-passkey-parse.ts —— 回归测试：createPasskey 从 WebAuthn 注册响应中解析 P-256 公钥。
 *
 * 背景：真实浏览器的 `AuthenticatorAttestationResponse.getPublicKey()` 返回 **SPKI DER**（91B，首字节 0x30），
 * 而非原始非压缩点（0x04‖X‖Y）；`attestationObject` 又是 CBOR 包装对象（含 authData）。
 * 本测试用 Node crypto 生成真实 P-256 密钥，构造可信的 SPKI / attestationObject，验证两条解析路径都正确。
 *
 * 运行：cd web && npx tsx scripts/verify-passkey-parse.ts
 */
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { createPasskey } from "../lib/passkey";

// ---------- 最小 CBOR 编码（仅测试构造用） ----------
function cborInt(n: number): number[] {
  if (n >= 0 && n < 24) return [n];
  if (n >= 0 && n < 256) return [0x18, n];
  if (n < 0) return cborInt(-1 - n).map((b, i) => (i === 0 ? 0x20 | (b & 0x1f) : b));
  throw new Error("cborInt out of range");
}
function cborBytes(b: Uint8Array): number[] {
  if (b.length < 24) return [0x40 | b.length, ...b];
  if (b.length < 256) return [0x58, b.length, ...b];
  throw new Error("cborBytes too long");
}
function cborText(s: string): number[] {
  const b = new TextEncoder().encode(s);
  return [0x60 | b.length, ...b];
}
function cborMap(entries: Array<[number[], number[]]>): number[] {
  return [0xa0 | entries.length, ...entries.flatMap(([k, v]) => [...k, ...v])];
}

// ---------- 构造真实 P-256 密钥材料 ----------
const { publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
const b64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const xBytes = new Uint8Array(b64u(jwk.x));
const yBytes = new Uint8Array(b64u(jwk.y));
const point = new Uint8Array([0x04, ...xBytes, ...yBytes]);
const spki = new Uint8Array((publicKey as KeyObject).export({ type: "spki", format: "der" }));

const expectedX = "0x" + Buffer.from(xBytes).toString("hex");
const expectedY = "0x" + Buffer.from(yBytes).toString("hex");
const credId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

// ---------- 构造 authData ----------
const rpIdHash = new Uint8Array(32).fill(0xab);
const flags = 0x41; // UP + AT
const signCount = new Uint8Array([0, 0, 0, 0]);
const aaguid = new Uint8Array(16);
const credIdLen = new Uint8Array([(credId.length >> 8) & 0xff, credId.length & 0xff]);
// COSE_Key: {1:2, 3:-7, -1:1, -2:x, -3:y}
const cose = new Uint8Array(
  cborMap([
    [cborInt(1), cborInt(2)],
    [cborInt(3), cborInt(-7)],
    [cborInt(-1), cborInt(1)],
    [cborInt(-2), cborBytes(xBytes)],
    [cborInt(-3), cborBytes(yBytes)]
  ])
);
const authData = new Uint8Array([
  ...rpIdHash,
  flags,
  ...signCount,
  ...aaguid,
  ...credIdLen,
  ...credId,
  ...cose
]);
const attestationObject = new Uint8Array(
  cborMap([
    [cborText("fmt"), cborText("none")],
    [cborText("attStmt"), [0xa0]],
    [cborText("authData"), cborBytes(authData)]
  ])
);

function mockCreate(opts: { withSpki: boolean }) {
  const fakeCred = {
    rawId: credId.buffer.slice(0),
    response: {
      attestationObject: attestationObject.buffer.slice(0),
      ...(opts.withSpki ? { getPublicKey: () => spki.buffer.slice(0) } : {})
    }
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { credentials: { create: async () => fakeCred } },
    configurable: true
  });
}

async function run(label: string, withSpki: boolean) {
  mockCreate({ withSpki });
  const c = await createPasskey();
  const okX = c.x.toLowerCase() === expectedX.toLowerCase();
  const okY = c.y.toLowerCase() === expectedY.toLowerCase();
  console.log(`${okX && okY ? "✅" : "❌"} ${label}`);
  console.log(`   got  x=${c.x}`);
  console.log(`   want x=${expectedX}`);
  console.log(`   got  y=${c.y}`);
  console.log(`   want y=${expectedY}`);
  return okX && okY;
}

async function main() {
  const a = await run("SPKI 路径（getPublicKey 返回 SPKI DER，真实浏览器行为）", true);
  const b = await run("attestationObject 回退路径（无 getPublicKey）", false);

  console.log("");
  console.log("SPKI length:", spki.length, "point[0]:", point[0].toString(16));
  if (a && b) {
    console.log("✅ 两条路径均通过");
  } else {
    console.log("❌ 存在失败路径");
    process.exit(1);
  }
}

main();
