#!/usr/bin/env node
// Generate P-256 / WebAuthn fixtures for Foundry tests (pure node:crypto, no third-party deps).
// Outputs contracts/test/fixtures/fixtures.json, read by test/*.t.sol via vm.readFile + vm.parseJson.
//
// Challenge derivation convention (matches FixedChallengeAccount in the tests):
//   single(n) = sha256(fixedBase ‖ 0x01 ‖ uint256be(n))
//   batch(n)  = sha256(fixedBase ‖ 0x02 ‖ uint256be(n))
// where fixedBase = fixtures.challenge. Test accounts override the real challenge formula (the real formula includes
// the account address only known after deployment, so it cannot be pre-signed offline), but keep the nonce -- replay protection is still testable.
import { generateKeyPairSync, sign as cryptoSign, createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RP_ID = "designerhub.xyz";
const ORIGIN = "https://designerhub.xyz";
const FIXED_BASE = Buffer.from("ab".repeat(32), "hex");

const sha256 = (buf) => createHash("sha256").update(buf).digest();
const b64url = (buf) => buf.toString("base64url");
const hex0x = (buf) => "0x" + buf.toString("hex");
const uint256be = (n) => {
  const b = Buffer.alloc(32);
  b.writeBigUInt64BE(BigInt(n), 24);
  return b;
};

const challengeSingle = (n) => sha256(Buffer.concat([FIXED_BASE, Buffer.from([1]), uint256be(n)]));
const challengeBatch = (n) => sha256(Buffer.concat([FIXED_BASE, Buffer.from([2]), uint256be(n)]));

function genKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  return {
    publicKey,
    privateKey,
    x: "0x" + Buffer.from(jwk.x, "base64url").toString("hex"),
    y: "0x" + Buffer.from(jwk.y, "base64url").toString("hex"),
  };
}

function p256Sign(privateKey, message) {
  const sig = cryptoSign("sha256", message, { key: privateKey, dsaEncoding: "ieee-p1363" });
  return { r: "0x" + sig.subarray(0, 32).toString("hex"), s: "0x" + sig.subarray(32).toString("hex") };
}

/// Build a WebAuthn assertion: clientDataJSON embeds derivedChallenge.
/// W3C spec: the signature covers sha256(authenticatorData ‖ sha256(clientDataJSON)).
/// Note: node's crypto.sign('sha256', msg) hashes msg again with sha256,
/// so we pass the concatenated raw data (ad ‖ sha256(cd)); after node's hash it is exactly the spec message hash.
function buildAssertion(key, derivedChallenge, { rpId = RP_ID, type = "webauthn.get", signCount = 1 } = {}) {
  const rpIdHash = sha256(Buffer.from(rpId));
  const flags = Buffer.from([0x05]); // UP | UV
  const authenticatorData = Buffer.concat([rpIdHash, flags, Buffer.from([0, 0, 0, signCount])]);
  const clientDataJSON = Buffer.from(JSON.stringify({ type, challenge: b64url(derivedChallenge), origin: ORIGIN }));
  const message = Buffer.concat([authenticatorData, sha256(clientDataJSON)]);
  const { r, s } = p256Sign(key.privateKey, message);
  return {
    authenticatorData: hex0x(authenticatorData),
    clientDataJSON: hex0x(clientDataJSON),
    r,
    s,
  };
}

// ---------------------------------------------------------------- //
//                            Generate                               //
// ---------------------------------------------------------------- //

const key1 = genKey();
const key2 = genKey();

const key1SingleN0 = buildAssertion(key1, challengeSingle(0));
const key1BatchN0 = buildAssertion(key1, challengeBatch(0));
const key2SingleN0 = buildAssertion(key2, challengeSingle(0));
const key2SingleN1 = buildAssertion(key2, challengeSingle(1));
const wrongRp = buildAssertion(key1, challengeSingle(0), { rpId: "evil.example" });
const wrongType = buildAssertion(key1, challengeSingle(0), { type: "webauthn.create" });
// Tamper with the signature: flip 1 bit in the last byte of key1SingleN0's r
const tamperedR =
  "0x" +
  Buffer.from(key1SingleN0.r.slice(2), "hex")
    .map((b, i) => (i === 31 ? b ^ 0x01 : b))
    .toString("hex");
const tamperedSig = { ...key1SingleN0, r: tamperedR };

// Pure P-256 random signature vectors (verifySolidity regression)
const p256vectors = [];
for (let i = 0; i < 8; i++) {
  const k = genKey();
  const msg = Buffer.from("p256-vector-" + i);
  const hash = sha256(msg);
  const { r, s } = p256Sign(k.privateKey, msg);
  p256vectors.push({ hash: hex0x(hash), x: k.x, y: k.y, r, s });
}

const fixtures = {
  rpId: RP_ID,
  origin: ORIGIN,
  challenge: hex0x(FIXED_BASE),
  keys: [{ x: key1.x, y: key1.y }, { x: key2.x, y: key2.y }],
  assertions: {
    key1_single_n0: key1SingleN0,
    key1_batch_n0: key1BatchN0,
    key2_single_n0: key2SingleN0,
    key2_single_n1: key2SingleN1,
    wrongRp,
    wrongType,
    tamperedSig,
  },
  p256vectors,
};

const outPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fixtures, null, 2));
console.log("fixtures written:", outPath);
