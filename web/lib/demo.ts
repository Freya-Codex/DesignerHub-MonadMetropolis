import type { Address } from "viem";
import type { SchemeSummary } from "./contracts";

/** Sample creator address (demo data only). */
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
    payout: "0x0000000000000000000000000000000000000000",
    contentHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    remixCount: 3,
    appliedCount: 5,
    tokenUri: "local://demo-1",
    schemeUri: "local://demo-1",
    name: "北欧风客厅 · 晨光白桦",
    nameEn: "Nordic Living Room · Morning Birch",
    description: "大落地窗引入自然光，浅色木地板搭配燕麦色布艺沙发，留白与绿植让客厅呼吸感十足。",
    descriptionEn: "Floor-to-ceiling windows bring in natural light; pale wood floors paired with an oatmeal fabric sofa, while open space and greenery give the living room room to breathe.",
    image: "/renders/nordic-livingroom.jpg",
    theme: "北欧风",
    themeEn: "Nordic",
    roomType: "客厅",
    roomTypeEn: "Living Room",
    furnitureCount: 7,
    createdAt: 1_752_000_000,
    generator: { provider: "kimi", model: "moonshot-v1-8k" }
  },
  {
    tokenId: 2n,
    creator: DEMO_CREATOR,
    parentId: 0n,
    agentId: 2n,
    price: 10_000_000_000_000_000n,
    payout: "0x0000000000000000000000000000000000000000",
    contentHash: "0x0000000000000000000000000000000000000000000000000000000000000002",
    remixCount: 2,
    appliedCount: 4,
    tokenUri: "local://demo-2",
    schemeUri: "local://demo-2",
    name: "日式卧室 · 静夜原木",
    nameEn: "Japanese Bedroom · Quiet Night Wood",
    description: "低矮床架贴近地面，榻榻米与纸艺吊灯营造宁静氛围，整墙原木衣柜收纳充足。",
    descriptionEn: "A low bed frame close to the floor, tatami and paper lanterns create a calm mood, and a full-wall solid wood wardrobe offers ample storage.",
    image: "/renders/japanese-bedroom.jpg",
    theme: "日式原木",
    themeEn: "Japanese Wood",
    roomType: "卧室",
    roomTypeEn: "Bedroom",
    furnitureCount: 8,
    createdAt: 1_752_000_100,
    generator: { provider: "qwen", model: "qwen2.5-72b-instruct" }
  },
  {
    tokenId: 3n,
    creator: DEMO_CREATOR,
    parentId: 0n,
    agentId: 3n,
    price: 10_000_000_000_000_000n,
    payout: "0x0000000000000000000000000000000000000000",
    contentHash: "0x0000000000000000000000000000000000000000000000000000000000000003",
    remixCount: 4,
    appliedCount: 6,
    tokenUri: "local://demo-3",
    schemeUri: "local://demo-3",
    name: "工业风书房 · 混凝土工作室",
    nameEn: "Industrial Study · Concrete Studio",
    description: "深灰水泥墙面搭配黑色金属书架与橙色点缀，粗粝与秩序并存，专注思考的工作间。",
    descriptionEn: "Dark gray concrete walls with black metal shelving and orange accents — raw texture and order side by side, a study built for focused thinking.",
    image: "/renders/industrial-study.jpg",
    theme: "工业风",
    themeEn: "Industrial",
    roomType: "书房",
    roomTypeEn: "Study",
    furnitureCount: 7,
    createdAt: 1_752_000_200,
    generator: { provider: "deepseek", model: "deepseek-chat" }
  }
];
