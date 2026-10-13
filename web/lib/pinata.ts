import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
  * IPFS pinning service.
  * - when PINATA_KEY/PINATA_SECRET (or PINATA_JWT) is set, uses real Pinata pinning;
  * - otherwise enters local demo mode: content is written to web/.local-pins, the URI is local://<cid>,
  *   served for reading by /api/cid/<cid>, so the full flow runs without any external key.
 */

export interface PinResult {
  cid: string;
  uri: string;
  type: "json" | "file";
}

export interface LocalRecord {
  cid: string;
  type: "json" | "file";
  json?: unknown;
  base64?: string;
  mime?: string;
}

const PINATA_KEY = process.env.PINATA_KEY ?? "";
const PINATA_SECRET = process.env.PINATA_SECRET ?? "";
const PINATA_JWT = process.env.PINATA_JWT ?? "";

const LOCAL_DIR = process.env.LOCAL_PIN_DIR ?? path.join(process.cwd(), ".local-pins");

function hasRemoteCreds(): boolean {
  return Boolean(PINATA_JWT || (PINATA_KEY && PINATA_SECRET));
}

function authHeaders(): Record<string, string> {
  if (PINATA_JWT) return { Authorization: `Bearer ${PINATA_JWT}` };
  return { pinata_api_key: PINATA_KEY, pinata_secret_api_key: PINATA_SECRET };
}

async function pinJsonRemote(content: unknown, name: string): Promise<string> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name } })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Pinata pinJSONToIPFS failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as { IpfsHash?: string };
  if (!json.IpfsHash) throw new Error(`Pinata 未返回 CID: ${text}`);
  return json.IpfsHash;
}

async function pinFileRemote(buffer: Uint8Array, fileName: string, mime: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(buffer)], { type: mime }), fileName);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: authHeaders(),
    body: form
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Pinata pinFileToIPFS failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as { IpfsHash?: string };
  if (!json.IpfsHash) throw new Error(`Pinata 未返回 CID: ${text}`);
  return json.IpfsHash;
}

function localCid(payload: string, tag: string): string {
  return `loc-${tag}-${createHash("sha256").update(payload).digest("hex").slice(0, 40)}`;
}

function saveLocal(record: LocalRecord): void {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOCAL_DIR, `${record.cid}.json`), JSON.stringify(record), "utf8");
}

export async function pinJson(content: unknown, name: string): Promise<PinResult> {
  const payload = JSON.stringify(content);
  if (hasRemoteCreds()) {
    const cid = await pinJsonRemote(content, name);
    return { cid, uri: `ipfs://${cid}`, type: "json" };
  }
  const cid = localCid(payload, "json");
  saveLocal({ cid, type: "json", json: content });
  return { cid, uri: `local://${cid}`, type: "json" };
}

export async function pinFile(buffer: Uint8Array, fileName: string, mime: string): Promise<PinResult> {
  const payload = Buffer.from(buffer).toString("base64");
  if (hasRemoteCreds()) {
    const cid = await pinFileRemote(buffer, fileName, mime);
    return { cid, uri: `ipfs://${cid}`, type: "file" };
  }
  const cid = localCid(payload, "file");
  saveLocal({ cid, type: "file", base64: payload, mime });
  return { cid, uri: `local://${cid}`, type: "file" };
}

const CID_PATTERN = /^loc-(json|file)-[0-9a-f]{40}$/;

export function readLocalRecord(cid: string): LocalRecord | null {
  if (!CID_PATTERN.test(cid)) return null;
  try {
    const raw = fs.readFileSync(path.join(LOCAL_DIR, `${cid}.json`), "utf8");
    return JSON.parse(raw) as LocalRecord;
  } catch {
    return null;
  }
}

export function splitDataUri(dataUri: string): { mime: string; base64: string } {
  const m = dataUri.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!m) throw new Error("previewImage 不是合法的 data URI");
  return { mime: m[1] ?? "image/png", base64: m[2] };
}
