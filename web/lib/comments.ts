import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * 链下评论存储：按 tokenId 存到本地 JSON 文件（web/data/comments/<tokenId>.json）。
 * 发布前由前端用 MetaMask 对评论文本签名，后端 verifyMessage 校验，全程不消耗 gas。
 */

export interface CommentItem {
  id: string;
  tokenId: number;
  author: string;
  text: string;
  signature: string;
  createdAt: string;
}

export interface CommentFile {
  tokenId: number;
  items: CommentItem[];
}

const DATA_DIR = process.env.COMMENTS_DATA_DIR ?? path.join(process.cwd(), "data", "comments");

function fileFor(tokenId: number): string {
  return path.join(DATA_DIR, `${tokenId}.json`);
}

export function isValidTokenId(tokenId: number): boolean {
  return Number.isInteger(tokenId) && tokenId >= 1 && tokenId < 1_000_000_000;
}

export function readComments(tokenId: number): CommentItem[] {
  if (!isValidTokenId(tokenId)) return [];
  try {
    const raw = fs.readFileSync(fileFor(tokenId), "utf8");
    const parsed = JSON.parse(raw) as CommentFile;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

export function appendComment(input: {
  tokenId: number;
  author: string;
  text: string;
  signature: string;
}): CommentItem {
  const item: CommentItem = {
    id: randomUUID(),
    tokenId: input.tokenId,
    author: input.author,
    text: input.text,
    signature: input.signature,
    createdAt: new Date().toISOString()
  };
  const items = readComments(input.tokenId);
  items.push(item);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload: CommentFile = { tokenId: input.tokenId, items };
  fs.writeFileSync(fileFor(input.tokenId), JSON.stringify(payload, null, 2), "utf8");
  return item;
}

/** 与前端约定的签名文本（SIWE 风格，包含方案号、地址与时间戳）。 */
export function buildCommentMessage(params: { tokenId: number; address: string; issuedAt: string }): string {
  return [
    "Designer Hub · Monad 评论签名",
    `方案 #${params.tokenId}`,
    `钱包地址: ${params.address}`,
    `签署时间: ${params.issuedAt}`,
    "",
    "签署即表示你确认以上身份，用于链下评论归属（不消耗 gas）。"
  ].join("\n");
}
