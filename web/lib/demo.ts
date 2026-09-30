import type { Address } from "viem";
import type { SchemeSummary } from "./contracts";

/** 示例创作者地址（仅演示数据）。 */
const DEMO_CREATOR: Address = "0x8Ba1f2D3A4B5c6D7E8f90123456789aBcDEf0123";

export const DEMO_SCHEME_FILES: Record<number, string> = {
  1: "nordic-livingroom.json",
  2: "japanese-bedroom.json",
  3: "industrial-study.json"
};

export const demoSchemes: SchemeSummary[] = [
  {
    tokenId: 1n,
    creator: DEMO_CREATOR,
    parentId: 0n,
    agentId: 1n,
    price: 10_000_000_000_000_000n,
    contentHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    remixCount: 3,
    appliedCount: 5,
    tokenUri: "local://demo-1",
    schemeUri: "local://demo-1",
    name: "北欧风客厅 · 晨光白桦",
    description: "大落地窗引入自然光，浅色木地板搭配燕麦色布艺沙发，留白与绿植让客厅呼吸感十足。",
    image: "/previews/nordic-livingroom.svg",
    theme: "北欧风",
    roomType: "客厅",
    furnitureCount: 7,
    createdAt: 1_752_000_000
  },
  {
    tokenId: 2n,
    creator: DEMO_CREATOR,
    parentId: 0n,
    agentId: 1n,
    price: 10_000_000_000_000_000n,
    contentHash: "0x0000000000000000000000000000000000000000000000000000000000000002",
    remixCount: 2,
    appliedCount: 4,
    tokenUri: "local://demo-2",
    schemeUri: "local://demo-2",
    name: "日式卧室 · 静夜原木",
    description: "低矮床架贴近地面，榻榻米与纸艺吊灯营造宁静氛围，整墙原木衣柜收纳充足。",
    image: "/previews/japanese-bedroom.svg",
    theme: "日式原木",
    roomType: "卧室",
    furnitureCount: 8,
    createdAt: 1_752_000_100
  },
  {
    tokenId: 3n,
    creator: DEMO_CREATOR,
    parentId: 0n,
    agentId: 1n,
    price: 10_000_000_000_000_000n,
    contentHash: "0x0000000000000000000000000000000000000000000000000000000000000003",
    remixCount: 4,
    appliedCount: 6,
    tokenUri: "local://demo-3",
    schemeUri: "local://demo-3",
    name: "工业风书房 · 混凝土工作室",
    description: "深灰水泥墙面搭配黑色金属书架与橙色点缀，粗粝与秩序并存，专注思考的工作间。",
    image: "/previews/industrial-study.svg",
    theme: "工业风",
    roomType: "书房",
    furnitureCount: 7,
    createdAt: 1_752_000_200
  }
];
