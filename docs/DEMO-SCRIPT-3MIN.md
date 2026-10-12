# Designer Hub · Monad — 网页 Demo 讲解稿（3 分钟）

> 用途：3 分钟现场/录屏演示的口播稿 + 操作动线。
> 主线：**Passkey 走过全流程**（免钱包、免 MON、relayer 代付 gas）。
> 站点：`/demo` 首页画廊 → `/passkey` → `/mint/create` → `/scheme/[id]` → `/remix/[id]` → `/trades` · `/board`。
> 时间轴按 180 秒设计，方括号内为镜头/操作，引号内为口播原文。

---

## 一、一句话定位（开场用）

「Designer Hub 把云筑家 App 导出的装修方案，变成 Monad 链上可署名、可 Remix、可即时分账的创作资产——一句话：家装设计的 GitHub。」

---

## 二、预演清单（开录前 5 分钟逐条打勾）

- [ ] 浏览器用 **`http://localhost`** 打开（不要用 `127.0.0.1`，否则 Passkey/WebAuthn 报 `invalid domain`）。
- [ ] 设备已录入指纹 / Face ID / Windows Hello；提前在 `/passkey` **创建过一次**，确认地址能派生出来。
- [ ] `web/.env.local` 已填 5 个合约地址；dev server 启动后**重启过一次**。
- [ ] relayer 可用（`RELAYER_PRIVATE_KEY` 已配），点一次「应用到我家」能看到链上 tx。
- [ ] 画廊已 `npm run seed`（3 个样例方案：北欧客厅 / 日式卧室 / 工业书房），至少 1 个 remix、1 个 applied，榜单不再是空的。
- [ ] 浏览器开好两个标签：A=`/demo` 首页、B=`/scheme/1` 详情（减少切页等待）。
- [ ] 关闭通知弹窗；把浏览器缩放到卡片文字清晰（建议 100%~110%）。
- [ ] 准备好 1 份 scheme JSON 粘贴用（`assets/schemes/` 里任取一个）。

---

## 三、分镜脚本

### 0:00 – 0:18 ｜ 开场定位（18s）
**画面**：`/demo` 画廊页整体，卡片网格。
**口播**：
> 「这是 Designer Hub。云筑家 App 里，用户用手机扫描房间、生成 3D 方案并导出；在这里，同一个方案 JSON 被铸造成一枚链上资产——可以 Remix、可以溯源、可以分账。它对应 Monad 黑客松 **Track 04：信任、身份与 AI 基础设施**。」

### 0:18 – 0:42 ｜ 画廊：链上真实数据（24s）
**操作**：鼠标扫过 2~3 张卡片，依次指点：户型预览图、创作者地址、`parentId` 谱系深度、价格、热度。
**口播**：
> 「画廊里的每一张卡片都是真实的链上数据，不是静态 mock。卡片上有户型预览、创作者、谱系深度和价格。方案被 Remix 或『应用到我家』之后，热度会实时变化——**热度 = Remix 数 ×2 + 应用次数 ×3**，注意力本身也变成了一种可计量的资产。」

### 0:42 – 1:05 ｜ Passkey：免钱包、免 gas（23s）
**操作**：进入 `/passkey` → 点「创建 Passkey」→ 系统弹指纹/Face ID → 页面显示派生出的 `CREATE2` 账户地址 → 点「签名上链」。
**口播**：
> 「主流程不需要钱包，也不需要持有 MON。点『创建 Passkey』，私钥生成在设备安全芯片里，永远不出设备。地址由 `CREATE2(公钥, 域名)` 确定性地派生出来，部署前就能预知。重头的这一步签名——指纹一按，完成链上操作，gas 由我们的 relayer 代付。签名绑定了完整的调用参数，所以 relayer 只能帮你付钱，改不了你任何一笔操作。」

### 1:05 – 1:30 ｜ 创建并铸造原创方案（25s）
**操作**：`/mint/create` → 拖入 / 粘贴 scheme JSON → 右侧预览刷新 → 点「固定到 IPFS」→ 点「铸造」→ 出现 NFT 铸造成功与 tokenId。
**口播**：
> 「现在把一个装修方案变成资产。拖入方案 JSON，右边立刻渲染出户型预览——它完全由方案数据生成。内容先固定到 IPFS，链上只存一个内容承诺的哈希，**内容本体永不上链**，这是隐私优先的溯源。然后铸造：这是一枚 ERC-721，`parentId = 0` 表示原创，同时记录生成它的 AI 代理 —— Kimi 已预注册为 1 号 agent，方案和模型都公开可归因。」

### 1:30 – 1:58 ｜ 方案详情 + 应用到我家（28s）
**操作**：`/scheme/1` 详情页 → 指谱系树 / 版本时间线 → 滑到底部评论框（可选，一笔带过）→ 回到顶部点「应用到我家」→ 显示分账金额与链上事件。
**口播**：
> 「这是方案详情页：上面是链上谱系树，下面是同一作者的版本时间线 v1、v2、v3——归属不锁在任何平台的数据库里。最关键的按钮是『应用到我家』。买家付款的同一笔交易里，钱就已经分完了：原创方案 90% 给创作者、10% 给平台，**没有平台金库、没有提现这一步**，谁也没法冻结。底下还能留言，钱包签名验证、零 gas。」

### 1:58 – 2:28 ｜ Remix：谱系分账 + 榜单（30s）
**操作**：回到详情点「Remix」→ `/remix/[id]` 调整风格 / 配色 / 家具参数 → 预览变化 → 点「铸造衍生」→ 成功后到 `/board` 看排名跃升。
**口播**：
> 「再看二次创作。点 Remix，进到风格参数编辑器，我怎么改配色、材质、家具都行，右侧实时预览。铸造衍生时，`parentId` 自动指向来源方案，谱系永久写在链上。分账也跟着变了：衍生方案 85% 归我、10% 平台、**5% 沿着谱系回馈给原创者**——这使得原创在被复用时也能持续拿到收益。回到榜单，热度按 Remix 和应用次数实时重算，我的排名已经往上跳了。」

### 2:28 – 2:45 ｜ 交易流水（17s）
**操作**：`/trades` 分账流水页，指一行：Token / 买家 / 创作者分成 / 平台分成 / 祖先池 / 区块 / 交易。
**口播**：
> 「每一笔分账都沉淀在这里——谁买的、创作者拿到多少、平台多少、祖先池多少，精确到区块和交易哈希。所有收益逻辑都可以在链上被独立审计。」

### 2:45 – 3:00 ｜ 收尾：这是给开发者的原语（15s）
**口播**：
> 「最后强调一点：这不只是一个 App。身份、溯源、可 Remix 资产加 AI 代理信任，四组原语都封装成了类型化的 SDK 和集成文档，任何第三方设计工具、资产库或 AI Agent 平台都能脱离我们的界面直接构建。谢谢。」

---

## 四、兜底话术（现场出状况时）

| 情况 | 应对 |
| --- | --- |
| Passkey 弹不出系统验证框 | 说明「这依赖设备安全芯片，录屏环境已提前验证过」→ 直接跳到已派生的地址截图继续讲。 |
| 上链等待时间长 | 「Monad 出块很快，通常一两秒」→ 先把焦点移回讲解逻辑，链上确认后在 `/trades` 补看 tx。 |
| 画廊空白 | 环境没配地址 / 没重启：切到 `/docs` 页讲机制，口头说明「画廊读的是 totalSupply 枚举」。 |
| Kimi 无返回 | 「没有 API key 时会回退到内置规则引擎，功能等价」——不用解释细节。 |
| 网络受限 | 用本地 `local://` demo 模式 + `/api/cid`，全流程仍可跑通。 |

---

## 五、可选：英文精简版（面向国际评委）

> 「Designer Hub turns an exported interior-design scheme into an on-chain creative asset — a GitHub for home design. Every scheme is an ERC-721 with on-chain lineage. Passkey login: the key lives in your device's secure element, gas is sponsored by a relayer that **cannot** tamper with your call. Mint an original, apply it to your home for an **instant 90/10 split** — no platform vault. Remix it, and **5% flows back along the lineage** to the original creator. Four primitives — identity, provenance, remixable assets, agent trust — shipped as a typed SDK any developer can build on. Track 04: Trust, Identity & AI Infrastructure.」

---

## 六、关键事实速查（讲解中可能被追问）

- 网络：Monad Testnet，chainId **10143**；浏览器 `testnet.monadexplorer.com`。
- 合约：`DreamScheme` / `SchemeMarket` / `AgentRegistry` / `ProvenanceRegistry` / `PasskeyAccountFactory`（地址见 `contracts/deployments/monad-testnet.json`）。
- 分账：原创 **90/10**；衍生 **85/10/5**（创作者 / 平台 / 祖先谱系池）；转售版税 ERC-2981 **5%**。
- 热度：**Remix ×2 + 应用次数 ×3**。
- 测试：Foundry **96 个用例全通过**；仓库内无任何私钥/密钥。
