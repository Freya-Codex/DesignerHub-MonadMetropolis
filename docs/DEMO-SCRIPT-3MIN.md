# Designer Hub · Monad — 3 分钟 Demo 讲解稿（v2 · 对齐最新站点）

> 用途：3 分钟现场 / 录屏演示的口播稿 + 操作动线。
> 主线：**Passkey 走过全流程**（免钱包、免 MON、relayer 代付 gas）。
> 站点动线：`/`（品牌首页）→ `/demo`（画廊）→ `/passkey` → `/mint/create` → `/scheme/[id]` → `/remix/[id]` → `/trades` · `/board`。
> 时间轴按 **180 秒**设计。方括号内为镜头 / 操作，引号内为口播原文。
> 赛道：Monad Metropolis 黑客松 **Track 04 — Trust, Identity & AI Infrastructure**。

---

## 一、一句话定位（开场用）

> 「Designer Hub 把云筑家（VirtuHome）App 导出的装修方案，变成 Monad 链上**可署名、可 Remix、可即时分账**的创作资产——一句话：**家装设计的 'GitHub'**。」

---

## 二、Track 04 技术要点（本 Demo 的"骨头"，被追问时按需展开）

评委看重的是「你为 Track 04 贡献了什么可复用的原语」。四组原语 + 两条工程细节，随时可点：

1. **身份原语｜Passkey 智能账户（Identity）**
   - 助记词-free：地址 = `CREATE2(x, y, rpIdHash, originHash)`，部署前即可预知。
   - 私钥生成在**设备安全芯片**内，永不出设备；用 Face ID / 指纹签名。
   - **链上验证真实 WebAuthn 断言**（P-256）。合约内置纯 Solidity 的 P-256 验签：先探 `RIP-7212` 预编译，缺失则回退到 Jacobian 曲线运算——所以在**没有该预编译的链**（含 Monad）也能跑。
   - 签名**绑定 calldata + nonce**：relayer 只能代付 gas，**改不了任何一笔调用**。
2. **信任原语｜No vault, No withdraw（Trust）**
   - **无平台金库、无 `withdraw()`**：付款在买家交易内**同笔即时分账**，没有人能冻结资金。
   - relayer **无需许可、可替换**：`execute(...)` 任何人都能调用，**授权来自签名而非发送者**。
3. **数据所有权原语｜内容承诺（Data Ownership）**
   - `ProvenanceRegistry` 链上只存 `keccak256(contentHash ‖ salt)`；**内容本体永不上链**，但溯源与时间戳可证。
4. **AI 基础设施原语｜生成器注册与归因（AI Infrastructure）**
   - `AgentRegistry` 注册 AI 生成器 + 声誉；`mint` / `remix` 把生成它的 `agentId` 写上链——**方案与其生成模型都公开可归因**。Kimi 已预注册为 `agentId = 1`。
5. **可组合资产｜谱系 + 版税（Composability）**
   - `DreamScheme`：ERC-721 + ERC-2981 + `parentId` 谱系（v1→v2→v3）。
   - `SchemeMarket`：创作者 `setPrice` 自主定价；应用时按谱系**即时分账**——原创 **90/10**，衍生 **85/10/5**。
6. **DX｜类型化 SDK（Design & Craft）**
   - `@designerhub/sdk`：把上面全部封装成**类型化调用**，第三方**无需我们的 UI**即可集成。

> 一句话收束：Track 04 的三件事——**你是谁（Passkey）、东西是不是你的（承诺+谱系）、AI 干的活算不算数（AgentRegistry）**——我们都做成了链上可验证、可组合的原语。

---

## 三、费用口径（讲"分账"时必须说清，避免和 "no vault" 打架）

- **平台 / 谱系费（每笔 "应用 / apply" 收）**：平台抽成——原创为应用价的 **10%**（即 90/10 里的那个 10%）；衍生为**平台 10% + 祖先谱系池 5%**（即 85/10/5）。**同一笔交易结清，无常设平台费、无订阅。**
- **转售版税（ERC-2981）**：默认 **5%**，创作者可在 **5%–10%** 之间配置；在**二次转售**时自动支付，**叠加**在 apply 分账之外。
- 所以 "no vault / no withdraw" 指的是**不托管资金**，并不等于"完全不收费"。

---

## 四、预演清单（开录前 5 分钟逐条打勾）

- [ ] 浏览器用 **`http://localhost`** 打开（不要用 `127.0.0.1`，否则 Passkey/WebAuthn 报 `invalid domain`）。
- [ ] 设备已录入指纹 / Face ID / Windows Hello；提前在 `/passkey` **创建过一次**，确认地址能派生。
- [ ] `web/.env.local` 已填 5 个合约地址；dev server 配置后**重启过一次**。
- [ ] relayer 可用（`RELAYER_PRIVATE_KEY` 已配），点一次「应用到我家」能看到链上 tx。
- [ ] 画廊已 seed（`npm run seed`：北欧客厅 / 日式卧室 / 工业书房），至少 1 个 remix、1 个 applied，榜单非空。
- [ ] 站点切到**英文**（顶栏 `EN`），并确认画廊/详情标题为英文（本地 demo pin 已补 `*En` 字段）。
- [ ] 开好两个标签：A=`/demo` 画廊、B=`/scheme/3` 详情（少一次切页等待）。
- [ ] 关闭通知弹窗；浏览器缩放 100%–110%。
- [ ] 备一份 scheme JSON 或一段 **base64url 方案码**待粘贴（`assets/schemes/` 任取）。
- [ ] 可选：SDK 现场演示前先跑通——`cd sdk && npm i viem && npx tsc -p tsconfig.json && npx tsx examples/read-schemes.ts`。

---

## 五、分镜脚本（0:00 – 3:00）

### 0:00 – 0:16 ｜ 开场定位（16s）
**画面**：`/` 品牌首页（hero）。
**口播**：
> 「这是 Designer Hub——**家装设计的 'GitHub'**。云筑家 App 里，用户用手机扫描房间、生成 3D 装修方案；在这里，同一个方案被铸成一枚链上资产：可 Remix、可溯源、可即时分账。它对标 Monad 黑客松 **Track 04：信任、身份与 AI 基础设施**。」

### 0:16 – 0:40 ｜ 画廊：真实的链上数据（24s）
**操作**：切到 `/demo`，光标扫过 2~3 张卡片，依次点指：AI 效果图 / 户型预览、创作者、`parentId` 谱系深度、价格、热度。
**口播**：
> 「画廊里每一张卡片都是真实链上数据，不是静态 mock。注意热度这个数——**热度 = Remix 数 × 2 + 应用次数 × 3**，注意力本身也变成了一种可计量、可交易的资产。」

### 0:40 – 1:04 ｜ Passkey：免钱包、免 gas（24s）
**操作**：进 `/passkey` → 点「创建 Passkey」→ 系统弹指纹/Face ID → 显示派生出的 `CREATE2` 账户地址 → 点「签名上链」。
**口播**：
> 「主流程不需要钱包，也不需要持有 MON。点『创建 Passkey』，私钥生成在**设备安全芯片**里、永不出设备；地址由 `CREATE2(公钥, 域名)` 确定性派生，部署前就能预知。现在是关键一步——指纹一按就完成链上操作，gas 由我们的 **relayer 代付**。而且对合约来说，签名**绑定了完整调用参数**，所以 relayer 只能帮你付钱，**改不了你任何一笔操作**。」

### 1:04 – 1:30 ｜ 创建并铸造原创（26s）
**操作**：`/mint/create` → 粘贴 scheme JSON（或 base64url 方案码）→ 右侧户型预览刷新 → 点「固定到 IPFS」→ 点「铸造」→ 出现 tokenId。
**口播**：
> 「把方案变成资产。粘贴方案 JSON（也支持紧凑的 **base64url 方案码**），右边立刻渲染户型预览——完全由方案数据生成。内容先固定到 IPFS，链上只存一个**内容承诺哈希**，**内容本体永不上链**，这是隐私优先的溯源。然后铸造：这是 ERC-721，`parentId = 0` 表示原创，同时记录生成它的 AI 代理——Kimi 是 **1 号 agent**，方案和模型都公开可归因。」

### 1:30 – 1:58 ｜ 方案详情 + 应用到我家（28s）
**操作**：`/scheme/3` 详情页 → 指谱系树 / 版本时间线 → 点「应用到我家」→ 显示分账金额与链上事件。
**口播**：
> 「详情页上半是链上谱系树，下半是同一作者的版本时间线 v1、v2、v3——**归属不锁在任何平台的数据库里**。最关键的是『应用到我家』：买家付款的**同一笔交易里，钱就已经分完了**——原创 90% 给创作者、10% 给平台，**没有平台金库、没有提现这一步**，谁也冻结不了。这里也把费用说清：apply 时平台抽 10%；如果之后发生转售，再按 **ERC-2981 版税 5%**（创作者可设 5%–10%）结算，两笔互不重叠。」

### 1:58 – 2:28 ｜ Remix：谱系分账 + 榜单（30s）
**操作**：回详情点「Remix」→ `/remix/[id]` 调风格/配色/家具参数 → 预览变化 → 点「铸造衍生」→ 成功后到 `/board` 看排名跃升。
**口播**：
> 「再看二次创作。点 Remix 进到风格参数编辑器，配色、材质、家具随便改，右侧实时预览。铸造衍生时，`parentId` 自动指向来源方案，**谱系永久写在链上**。分账也跟着变：衍生是 **85% 归我、10% 平台、5% 沿着谱系回馈给原创者**——原创被反复复用时，也能持续分到钱。回到榜单，热度按 Remix 与应用次数实时重算，我的排名已经往上跳了。」

### 2:28 – 2:45 ｜ 交易流水（17s）
**操作**：`/trades` 分账流水，指一行：Token / 买家 / 创作者分成 / 平台分成 / 祖先池 / 区块 / 交易。
**口播**：
> 「每一笔分账都沉淀在这里——谁买的、创作者拿多少、平台多少、**祖先池多少**，精确到区块和交易哈希。所有收益逻辑都可以在链上被**独立审计**。」

### 2:45 – 3:00 ｜ 收尾：这是给开发者的原语（15s）
**口播**：
> 「最后强调：这不只是一个 App。身份、溯源、可 Remix 资产、AI 代理信任——四组原语都封装成了**类型化 SDK `@designerhub/sdk`** 和集成文档，任何第三方设计工具、资产库或 AI Agent 平台都能**脱离我们的界面**直接构建。谢谢。」

---

## 六、兜底话术（现场出状况时）

| 情况 | 应对 |
| --- | --- |
| Passkey 弹不出系统验证框 | 「这依赖设备安全芯片，录屏环境已提前验证过」→ 直接跳到已派生的地址截图继续讲。 |
| 上链等待时间长 | 「Monad 出块很快，通常一两秒」→ 先讲机制，确认后在 `/trades` 补看 tx。 |
| 画廊空白 | 环境没配地址 / 没重启：切到 `/docs` 讲机制，口头说明「画廊经 `totalSupply` 枚举」。 |
| Kimi 无返回 | 「没有 API key 时回退到内置规则引擎，功能等价」——不展开。 |
| 网络受限 | 用本地 `local://` demo 模式 + `/api/cid`，全流程仍可跑通。 |
| 现场跑 SDK 报 RPC | Monad 公共 RPC 限 **15 req/s**：SDK 读取已做顺序限速（`paceMs`），稍等重试即可。 |

---

## 七、可选：英文精简版（面向国际评委）

> "Designer Hub is a **'GitHub' for interior design**. Every scheme becomes an ERC-721 with on-chain lineage — you can remix it, trace it, and get paid from it. Sign in with a **Passkey**: the key stays in your device's secure element, the address is `CREATE2`-derived, and a **relayer pays gas without being able to alter your call** because the signature binds the calldata and nonce. Mint an original, apply it for an **instant 90/10 split** — no platform vault, no withdraw. Remix it and **5% flows back along the lineage** to the original creator. Content never goes on-chain — only a `keccak256` commitment. AI generators are registered on-chain (**Kimi = agentId 1**), so both the scheme and the model are attributable. Four primitives — identity, provenance, data ownership, and agent trust — shipped as a typed SDK (`@designerhub/sdk`) any developer can build on. **Track 04: Trust, Identity & AI Infrastructure.**"

---

## 八、关键事实速查（Q&A 备用）

- 网络：Monad Testnet，chainId **10143**；浏览器 `testnet.monadexplorer.com`。
- 合约（5 个）：`DreamScheme` / `SchemeMarket` / `AgentRegistry` / `ProvenanceRegistry` / `PasskeyAccountFactory`（地址见 `contracts/deployments/monad-testnet.json`；均公开链上信息，可安全展示）。
- 分账：原创 **90/10**；衍生 **85/10/5**（创作者 / 平台 / 祖先谱系池）；转售版税 ERC-2981 **5%**（可配 5%–10%）。
- 热度：**Remix × 2 + 应用次数 × 3**。
- 身份：地址 = `CREATE2(x, y, rpIdHash, originHash)`；私钥不出安全芯片；链上验证 WebAuthn 断言（P-256，含 RIP-7212 回退）。
- 溯源：链上仅 `keccak256(contentHash ‖ salt)`，内容永不上链。
- AI 归因：Kimi 预注册为 `agentId = 1`。
- SDK：`@designerhub/sdk`（类型化；已实测可 build + 跑通 `examples/read-schemes.ts`）。
- 测试：Foundry **96 个用例全通过**；仓库内无任何私钥 / 密钥。
- 规划：正在与**实际运营的装修公司**谈合作（助其用 AI 出方案并链上确权）；Post-event 走**小红书**营销提升曝光；持续按用户反馈完善方案、增加展示功能；希望获得**算力/token 支持**并与 **Kimi** 官方合作扩大曝光。
