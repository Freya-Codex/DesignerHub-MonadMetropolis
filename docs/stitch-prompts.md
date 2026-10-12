# Designer Hub · Monad — Google Stitch 网页设计提示词包

> 用途：在 [Google Stitch](https://stitch.withgoogle.com) 里重新规划 / 重绘 `monad` 项目的网页。
> 用法：先跑 **① 设计系统总纲**（定调），再逐屏跑 **② 页面提示词**（Stitch 一次生成一屏效果最好）。
> 项目事实：Monad 测试网 DApp（chainId 10143），赛道 **Track 04 — Trust, Identity & AI Infrastructure**，中英双语，Passkey 免钱包为主流程。

---

## 0. 一句话产品定位（提示词里反复复用）

**中文**：把 AI 生成的装修设计方案变成链上「可 Remix、可归因、可即时分账」的创作资产——**家居设计界的 GitHub**。

**English**：Turn AI-generated interior-design schemes into on-chain creative assets that are remixable, attributable and revenue-sharing — **the GitHub for Interior Design**.

---

## ① 设计系统总纲（先跑这条）

```
Design a modern web3 + design-tool hybrid product website called "Designer Hub" — a marketplace where AI-generated interior design schemes become on-chain ERC-721 creative assets that people can remix, cite, and revenue-share. Tagline: "The GitHub for Interior Design".

BRAND & TONE
- Audience: web3 builders, AI creators, and interior-design hobbyists. Confident, technical-but-clean, quietly premium. Not neon, not playful-crypto.
- The signature idea is ARCHITECTURAL BLUEPRINT: thin dimension lines, small tick marks and tiny monospace annotations (like measurement lines on a floor plan) used as section dividers and accents.

COLOR SYSTEM
- Dark "ink" sections: near-black #0F0F12, with a very subtle faint grid/blueprint background and soft violet glow blobs.
- Light "paper" sections: warm off-white #FBFAF9.
- Primary accent: electric violet #6E54FF (deep #4F47EB), used for CTAs, links, active states.
- Secondary: plum #25043A (deep dark panels), soft coral #FFA1A1 (highlight only).
- Text on light: ink #0F0F12 with muted gray #727285 for body; on dark: white with 60–70% white for body.
- Hairline borders #ECECEC, rounded cards (12–16px radius), soft long shadows.

TYPOGRAPHY
- Display headings: a geometric grotesque like Archivo, tight tracking, large sizes (hero 56–64px desktop / 34–36px mobile).
- Body: clean system sans (Inter / PingFang SC for Chinese).
- Technical labels, numbers, chain IDs, addresses, contract names: MONOSPACE, UPPERCASE, wide letter-spacing (e.g. "CHAIN 10143 · MONAD TESTNET").
- Small "eyebrow" labels above headings: uppercase mono, e.g. "FEATURED · 精选方案".

LAYOUT & COMPONENTS
- Max content width ~1152px, generous whitespace, strong vertical rhythm.
- Sticky top bar: brand mark (a white hexagonal line "house/blueprint" glyph on a violet rounded square) + wordmark "Designer Hub" + tiny mono subtitle "On-chain. Remixable. Attributable · MONAD"; center/right nav: 首页 HOME / 画廊 GALLERY / 铸造 MINT / 交易 TRADES / 排行榜 BOARD / 文档 DOCS; far right a single "Passkey" pill control (shows "创建通行密钥" when not set, or "Passkey · 0x1a2b…" with a green status dot when ready) and a small "中 / EN" language toggle.
- Cards ("sheets"): white surface, 1px hairline border, soft shadow, hover lifts border to violet.
- Buttons: filled violet primary (white text), outline-light on dark, ghost/text links. Rounded ~10px.
- Footer: hairline top border, mono meta line "CHAIN 10143 · MONAD TESTNET · ERC-721 + ERC-2981 · IPFS" plus links RPC / 水龙头 Faucet / 浏览器 Explorer / 玩法文档 Docs.

Deliver a coherent design system (color, type scale, spacing, components) that works for BOTH desktop web and mobile, with light and dark sections mixed on the same page.
```

---

## ② 页面提示词（逐屏生成）

### 2.1 首页 Home `/`

```
Design the HOME page for "Designer Hub" (the on-chain GitHub for Interior Design) on Monad Testnet.

SECTION 1 — HERO (dark, near-black with subtle blueprint grid + violet glow blobs)
- Eyebrow (mono, uppercase, muted): "MONAD TESTNET · CHAIN 10143 · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE"
- H1 (huge, white): "家居设计界的 GitHub" with "GitHub" highlighted in electric violet.
- Subtext (white 70%): "把装修设计方案变成链上可 remix、可归因、可分账的创作资产。由 AI 生成方案，在这里发布上链，任何人都能在你的设计上继续创作；parentId 记录完整谱系，收益按创作者定价自动分账。"
- A blueprint signature line: a horizontal thin dimension line with tick marks at both ends, center captioned in tiny mono: "ERC-721 · ERC-2981 · IPFS".
- Buttons: filled violet "进入画廊" + outline-light "创建我的方案" + ghost link "领取测试 MON ↗".
- A 4-column stats strip separated by a top hairline: SCHEMES / REMIX / APPLIED / FURNITURE with big display numbers (e.g. 3 / 8 / 12 / 47).

SECTION 2 — CAPABILITIES (light paper)
- Eyebrow "CAPABILITIES · 核心能力", H2 "一套可组合的链上创作协议".
- Three cards, each with a mono number 01/02/03, a title and 2-line body:
  01 "方案即资产 / Scheme as an Asset" — every scheme is minted as ERC-721, metadata + layout on IPFS, AI credit recorded on-chain.
  02 "谱系与归因 / Lineage & Attribution" — parentId records every remix; original creators keep ERC-2981 royalties.
  03 "创作者定价 · 自动分账 / Creator Pricing · Auto Split" — creators set their own price; applying a scheme splits instantly: 90/10 for originals, 85/10/5 for derivatives.

SECTION 3 — FEATURED (light)
- Eyebrow "FEATURED · 精选方案", H2 "最受引用的设计", right-aligned link "查看全部 →".
- 3 scheme cards: large preview image (interior room photo/render), a small style chip (e.g. 北欧 Nordic), scheme title, creator short address in mono, and a metrics row (remix count, applied count, price in MON, e.g. "0.01 MON"). One card shows a "衍生物 Derivative" badge.

SECTION 4 — HOW IT WORKS (light)
- Eyebrow "HOW IT WORKS · 使用流程", H2 "从灵感到回报，四步走完".
- 4 numbered step cards: 1 生成方案 Generate "用 AI 对话生成装修方案"; 2 发布上链 Publish "铸造成 NFT，署名与谱系上链"; 3 被 Remix Get Remixed "他人在你的设计上继续创作"; 4 自动分账 Get Paid "被应用时按定价即时分账".

SECTION 5 — CLOSING CTA (dark panel, grid sheet)
- H2 "开始你的第一个链上设计", subtext "无需钱包也可用 Passkey 一键铸造，gas 由中继代付。先逛逛画廊，找一份喜欢的设计继续创作。"
- Buttons "创建我的方案" + "浏览画廊".

Use bilingual labels (Chinese primary, small English). Desktop first, then a mobile version.
```

### 2.2 画廊 Gallery `/demo`

```
Design the GALLERY page ("方案画廊 / Scheme Gallery") for Designer Hub.

- Header block: eyebrow mono "GALLERY · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE", H1 "方案画廊", a one-line description, and a stats strip (SCHEMES / REMIX / APPLIED / FURNITURE).
- A "演示数据模式 / Demo Data Mode" notice chip with an info panel explaining that once the contract address is set the gallery switches to live on-chain data.
- Filter row: a "风格筛选 / Filter by style" chip group — 全部 All / 现代 Modern / 北欧 Nordic / 日式 Japanese / 工业 Industrial — with counts, active chip filled violet.
- Main grid of scheme cards (responsive 1 / 2 / 3 columns): each card = preview image, style chip, title, creator mono short address, AI-agent attribution ("AI · Kimi"), metrics (remix / applied / price MON), and a small "Derivative" tag when it has a parent.
- Include a loading skeleton state, an empty state ("还没有任何方案…" with a "去创建" button), and an error state.

Keep it dense but airy; the grid should feel like a design-asset marketplace, not a crypto dashboard.
```

### 2.3 铸造中心 Mint `/mint`

```
Design the MINT CENTER page ("铸造中心 / Mint Center") for Designer Hub.

- Header: eyebrow "MINT · 铸造中心", H1 "铸造中心", description mentioning parentId lineage; a "演示数据模式" chip when applicable.
- A dark "MY MINT · 我的铸造" stats panel (4 stats): SCHEMES 我的方案 / MINTS 链上铸造 / REMIX RECEIVED 被衍生 / REMIX SENT 我衍生他人.
- Three big entry cards, each with eyebrow + title + CTA:
  - Origin · 原创 → "铸造原创方案" → button "去创建页"
  - Remix · 衍生 → "从他人作品 Remix" → button "看 Remix 机会"
  - Version · 迭代 → "发布新版本" → button "看我的方案"
- A "REMIX OPPORTUNITIES · 可衍生机会" section: "在别人的设计上继续创作", sorted by popularity, with a note "已排除你衍生过的方案", listing compact scheme rows/cards with a "Remix" action.
- If the wallet is on the wrong chain, show a "切换到 Monad 测试网" warning callout.
```

### 2.4 创建方案 Create `/mint/create`

```
Design the CREATE page where a user turns a design scheme into an on-chain NFT.

- Left: a large preview / dropzone for the scheme (accepts a "方案码 base64url" paste, an image preview, or an uploaded scheme JSON preview showing a rendered room).
- Right: a clean form — Scheme title, style selector (现代/北欧/日式/工业), room type, a price field with "MON" suffix ("创作者自主定价"), AI attribution selector (defaults to "Kimi · agentId 1"), and a "选择预览图" control.
- Show the lineage/attribution note: "铸造为原创 (parentId = 0)" vs when remixing "衍生自 #12".
- Primary CTA "铸造成 NFT"; if the user has a Passkey show "用 Passkey 一键铸造（gas 由中继代付）", otherwise show a "连接钱包（备选）" secondary button.
- Add inline validation states and a small "上传即存 IPFS" hint.
```

### 2.5 方案详情 Scheme Detail `/scheme/[id]`

```
Design the SCHEME DETAIL page for a single on-chain interior-design scheme (token #id).

- Hero band: large room preview/render on the left; on the right — scheme title, style chip, creator address (mono, with copy), "AI · Kimi" attribution, current price in MON, and a "衍生物 · parent #12" breadcrumb when applicable.
- Primary actions: filled violet "应用到我家" (buy/apply → instant split) and outline "Remix 这份设计"; owner-only "上架 / 改定价 (setPrice)" control.
- A "SPLIT PREVIEW" mini panel showing how payment divides: for originals 90% creator / 10% platform; for derivatives 85% creator / 10% platform / 5% ancestor lineage pool — visualize as a segmented bar.
- A "LINEAGE · 谱系" section: a small on-chain tree/graph (parent → this → children) with token ids.
- A "VERSIONS · 版本时间线" vertical timeline (v1 → v2 → v3) with dates and author.
- A "COMMENTS · 评论" section: off-chain, wallet-signature verified, zero gas — input + list of comments with avatar, short address, timestamp.
- A details panel listing: contract, tokenId, IPFS CID, ERC-2981 royalty (5%), provenance commitment hash.

Blend a product page (like a design-asset store) with a provenance/audit panel.
```

### 2.6 Remix 页 `/remix/[id]`

```
Design the REMIX page — forking someone else's on-chain scheme.

- Header: "Remix #12 — <scheme title>", a clear "原创作者 & 谱系将上链归因 / lineage will be recorded on-chain" callout.
- Side-by-side: left = the ORIGINAL scheme preview (read-only); right = your NEW version editor/preview (you modify style/colors/furniture before minting).
- A diff/summary strip: "改动 Changes" chips (style changed, X furniture replaced).
- A lineage preview: "新方案 will point to parent #12" with a mini tree.
- Actions: "用 Passkey 铸造这段衍生（gasless）" primary, "连接钱包（备选）" secondary.
- Show the derivative split reminder: 85/10/5 (creator / platform / ancestor pool).
```

### 2.7 交易 Trades `/trades`

```
Design the TRADES / LEDGER page ("交易记录 / Trade History") for Designer Hub.

- Header: eyebrow "TRADES · 链上交易账本", H1 "交易记录", description: every "应用到我家" triggers an on-chain split with no platform vault and no withdraw step.
- Dark "LEDGER OVERVIEW · 账本总览" stats panel: APPLIES 累计应用 / VOLUME 累计成交 (MON) / TO CREATORS 创作者所得 (violet accent) / TO TREASURY 平台所得.
- A "MY EARNINGS · 我的分账" card: "我的支出与收入" with rows SPENT 我支付的费用 / EARNED 我作为创作者收到 / SETTLEMENT 结算方式 ("即时分账，无需提取"), plus a link "在浏览器中查看 SchemeMarket ↗".
- "FLOW · 交易流水" section: "全部应用记录" with filter tabs (全部 All, 我买的, 我卖的, 分账), and a table of rows: time, scheme (with thumbnail), buyer short address, amount MON, split breakdown (creator/platform/ancestor), tx hash (mono, linked).
- Include demo-data-mode chip and an "索引待生成 / Index pending" state.
```

### 2.8 排行榜 Board `/board`

```
Design the LEADERBOARD page ("创意排行榜 / Creative Leaderboard") for Designer Hub.

- Header: eyebrow "LEADERBOARD · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE", H1 "创意排行榜", and an explainer: "热度 = 被应用 × 3 + 被 Remix × 2".
- A dark "TOP SCHEME · 榜首" hero card: the #1 scheme as a large feature — preview image, title, style, creator, and its metrics (remix / applied / furniture count).
- A ranked list (#1–#10) of schemes: rank number (big display), thumbnail, title, creator, a small horizontal "heat" bar, and metric columns (REMIX / APPLIED / FURNITURE). Top 3 get a subtle violet/gold accent.
- Include demo-data-mode chip and empty state.
```

### 2.9 Passkey 页 `/passkey`

```
Design the PASSKEY page — the seedless, gasless identity entry for Designer Hub.

- Dark hero: eyebrow "PASSKEY · 无助记词账户（主流程）", H1 "用 Face ID 登录 web3".
  Subtext: "无需助记词、无需安装浏览器插件、无需持有 MON。私钥在设备安全芯片内生成且永不导出；relayer 代付 gas，你只需一次指纹 / 面容确认即可完成链上动作。Passkey 密钥不接触资金，支付密钥由用户自选。"
  Buttons: "创建通行密钥 (Create passkey)" primary, "浏览排行榜" outline, "机制说明" ghost.
- A step panel "Step 1–3 · 创建 → 推导地址 → 部署" as a vertical stepper with live status: shows RP ID (domain localhost), the derived CREATE2 account address (mono), and deploy status / tx hash. Each step has pending / success / error states.
- A small "高级模式 / 备选" block: "已有钱包？连接 MetaMask" — an outline button with a note that paid actions (应用到我家) require the wallet.
- On a non-HTTPS/localhost origin, show an inline warning that a valid domain (localhost / https) is required for WebAuthn.
```

### 2.10 文档 Docs `/docs`

```
Design the DOCS / MECHANICS page ("玩法与规则 / Mechanics & Rules") for Designer Hub.

- Dark hero: eyebrow "MONAD HACKATHON · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE", H1 "玩法与规则", subtext about scheme → on-chain remixable/attributable/revenue-splitting creative assets where every iteration, citation and application settles into an on-chain attention asset.
- A "quick start / 快速开始" numbered guide (claim test MON → create → remix → track on Mint & Trades → watch the Leaderboard).
- A FAQ accordion with items like: "铸造和 Remix 要花钱吗？" / "Passkey 会碰我的资金吗？" / "评论为什么不用 gas？" / "方案码（base64url）是什么？" / "没配置 Pinata / Kimi 也能演示吗？" / "方案内容会不会被篡改？"
- Optional: a technical "primitives" section listing the 5 contracts (DreamScheme / SchemeMarket / AgentRegistry / ProvenanceRegistry / PasskeyAccountFactory) as clean code-styled cards with one-line descriptions.
```

---

## ③ 组件级提示词（补细节时用）

**SchemeCard（方案卡）**
```
Design a single scheme card component: rounded white card, hairline border, hover → violet border lift. Top: 4:3 preview image of an interior room, with an overlay style chip (e.g. "北欧 Nordic") top-left and a price chip "0.02 MON" top-right. Bottom: title (bold), creator short address in mono gray, a small "AI · Kimi" byline, and a metrics row with tiny icons: ⟳ 3 remix · ⬚ 5 applied. If derived, a small "衍生物" tag.
```

**LineageTree（谱系树）**
```
Design a compact on-chain lineage tree component: small rounded nodes labelled "#12 v1", "#18 v2", "#24 v3" connected by thin vertical/elbow lines (blueprint style), the current node highlighted in violet, ancestors muted, children dashed. Add tiny mono captions "parentId" on the edges.
```

**VersionTimeline（版本时间线）**
```
Design a vertical version timeline: a thin left rail with dots; each entry shows version tag "v2", a short change summary, author short address + date in mono. Current version dot filled violet.
```

**SplitBar（分账条）**
```
Design a payment-split visualization: a single horizontal rounded bar segmented by percentage with labels — original: 90% 创作者 Creator (violet) / 10% 平台 Platform (gray); derivative: 85% Creator (violet) / 10% Platform (gray) / 5% 祖先谱系池 Ancestor pool (coral). Include a legend with exact numbers.
```

---

## ④ 在 Stitch 里的使用建议

1. **先总纲后分屏**：第一条总纲用来建立项目风格基线；之后每屏单独 prompt，画面更可控、更完整。
2. **一次一屏**：Stitch 每个提示词只生成一个视图（桌面或移动）。首页这种多区块长页，建议拆成「Hero+Stats」「Capabilities」「Featured」「How it works」「CTA」分段生成再拼。
3. **字体与配色**：提示词里写清 hex（#0F0F12 / #FBFAF9 / #6E54FF）与「monospace uppercase labels + geometric display headings」，风格一致性会明显更好。
4. **Blueprint 记忆点**：每个区块都提一句 "thin dimension lines with tiny monospace annotations" ——这是本项目的视觉签名，别丢。
5. **双语**：Stitch 默认生成英文 UI。若要中文界面，在提示词里明确 "Chinese primary with small English subtitles"，并把上文的文案原样贴进去。
6. **Experimental 模式**：想更贴近现有站点，可上传现有截图（`brand/pg-home2.png`、`docs/screenshots/*.png`）作为 image prompt，再用文字描述要改的方向（例如「更留白、卡片更克制、violet 更收敛」）。
7. **迭代手法**：对某块不满意，直接选中那块再 prompt「make this section darker / reduce visual noise / increase whitespace / change CTA to ...」，比整页重生成更省。
8. **导出**：Stitch 结果可复制到 Figma（Paste to Figma）或导出前端代码，作为重绘 `web/` 的设计参考。

---

## ⑤ 可复用的「英文速用版」总纲（给 Stitch 直接粘贴）

```
Design a website for "Designer Hub" — the GitHub for Interior Design. It turns AI-generated interior design schemes into on-chain ERC-721 assets that can be remixed, attributed, and revenue-shared. Built on Monad Testnet (chain 10143), Track 04: Trust, Identity & AI Infrastructure.

Visual language: architectural blueprint meets premium fintech. Dark near-black sections (#0F0F12) with faint blueprint grids and violet glow; light warm-paper sections (#FBFAF9). Accent electric violet #6E54FF. Thin dimension lines with tiny monospace uppercase annotations are the signature motif. Geometric display headings (Archivo-like) + system body font + monospace for technical labels/addresses/numbers. Rounded cards, hairline borders, soft shadows. Bilingual labels (Chinese primary, small English). Sticky top bar with a single "Passkey" control and a 中/EN toggle; nav: 首页 画廊 铸造 交易 排行榜 文档.

Feel: clean, technical, quietly premium — a design-asset marketplace, not a crypto casino.
```
