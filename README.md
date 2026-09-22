# 云筑家 · DreamHome on Monad

> 用手机扫描房间生成 3D 模型并做虚拟装修的创业项目（VirtuHome），把**装修设计方案**变成 Monad 链上
> **可 remix、可归因、可分账**的创作资产——家居设计界的 GitHub。
> 参赛赛道：Monad 黑客松 **Social / Attention / Culture**。

每份装修方案 = 一枚 ERC-721 NFT：原创铸造（parentId=0）或 Remix 衍生（parentId 指向来源，谱系上链可追溯）；
任何用户支付 0.01 MON「应用到我家」时，**90% 即时转给创作者、10% 累积到平台金库**；转售按 ERC-2981 收取 5% 版税。
注意力（remix 数 × 被应用次数）即资产，由链上事件实时聚合为排行榜。
同一作者持续迭代时 parentId 指向自己的上一版，形成链上 **v1 → v2 → v3 版本时间线**；评论走**链下存储 + 钱包签名验证**（SIWE 风格），零 gas。

---

## 架构

```
┌──────────────────────────── web/ ────────────────────────────┐
│ Next.js 14 App Router + TS + viem + wagmi + RainbowKit      │
│                                                              │
│ 画廊 /scheme/[id] /create /remix/[id] /mint /trades /board   │
│   │ 读取 SchemeMinted 事件 + IPFS 元数据                      │
│   │ 写交易：mint / applyScheme                               │
│ ├─ /api/pin    方案JSON+预览图 → Pinata 固定 → ipfs:// URI    │
│ ├─ /api/kimi   装修建议 → Kimi(Moonshot) API（可本地兜底）     │
│ ├─ /api/comment 评论（钱包签名校验 + 本地 JSON 存储，零 gas）   │
│ └─ /api/cid    本地演示模式 local:// 读取                     │
└──────────────┬─────────────────────────┬─────────────────────┘
               ▼                         ▼
┌───────────────────────┐   ┌──────────────────────────────┐
│   Monad Testnet       │   │  IPFS（Pinata，可本地演示）    │
│   Chain ID 10143      │   │  方案 JSON / 预览图 / 元数据   │
│                       │   │  contentHash = keccak256()    │
│ DreamScheme (ERC-721   │   │                              │
│  + ERC-2981 5%)       │   └──────────────────────────────┘
│ SchemeMarket (90/10)  │
└───────────────────────┘
```

### 合约

| 合约 | 地址（部署后填写） | 说明 |
| --- | --- | --- |
| `DreamScheme` | `0x…`（见 `contracts/deployments/monad-testnet.json`） | ERC-721 + ERC-2981（5%）；`mint(parentId, contentHash, tokenURI)` 开放铸造；`parentId=0` 原创、`>0` remix 来源；记录 `creator`；`lineageOf` 返回完整谱系、`versionLineOf` 返回同作者版本链（v1/v2/v3）；事件 `SchemeMinted(tokenId, creator, parentId, contentHash)` |
| `SchemeMarket` | `0x…` | `applyScheme(tokenId)` payable（预设 0.01 MON）：90% 转创作者、10% 累积 `platformAddress` 可 `withdraw()`；事件 `SchemeApplied` |

分账细节：创作者地址在铸造时固化，NFT 转手不影响分账对象；创作者拒收 ETH 时份额计入平台代管（`CreatorShareEscrowed`），
避免应用流程被卡死。

---

## 目录结构

```text
monad/
├── contracts/                 Foundry 合约工程
│   ├── src/DreamScheme.sol    方案 NFT（ERC-721 + ERC-2981 5% + 谱系/版本链）
│   ├── src/SchemeMarket.sol   应用付费与 90/10 分账
│   ├── test/                  Foundry 单元测试（35 个用例）
│   ├── script/Deploy.s.sol    部署脚本，输出并落盘合约地址
│   ├── deployments/           部署记录（monad-testnet.json 部署后自动生成）
│   └── lib/                   内置依赖源码（OpenZeppelin 5.3.0 / forge-std 1.16.2）
├── web/                       Next.js 14 前端 + API
│   ├── app/                   8 个页面：/ · /scheme/[id] · /create · /remix/[id] · /mint · /trades · /board · /docs
│   ├── app/api/               5 个路由：/pin · /kimi · /comment · /cid/[cid] · /demo/[id]
│   ├── components/            VersionTimeline · CommentsSection · SchemeCard · LineageTree · SchemePreview
│   ├── lib/                   wagmi/合约/主题/IPFS/Pinata/Kimi 封装
│   └── scripts/seed.ts        用示例数据铸造初始方案
├── assets/schemes/            3 套示例方案 JSON + SVG 预览图（demo 冷启动用）
├── .env.example               环境变量总览（合约 + 前端两套）
└── README.md
```

---

## 快速开始

前置：`foundry`（≥1.0）、`node` ≥ 18、MetaMask。合约依赖已内置在 `contracts/lib`（vendored：OpenZeppelin 5.3.0、forge-std 1.16.2），
克隆后**无需** `forge install` 即可直接编译测试。

### 1. 运行合约测试

```bash
cd contracts
forge test          # 35 passed（铸造/谱系/版本链/分账金额/代管/提现）
```

### 2. 领取测试币（Monad 测试网）

- 网络：Chain ID `10143`，RPC `https://testnet-rpc.monad.xyz`，原生代币 MON
- 水龙头：<https://faucet.monad.xyz>（粘贴部署者钱包地址，通常几分钟到账）
- 在 MetaMask 中添加 Monad 测试网（RPC 同上，区块浏览器 <https://testnet.monadexplorer.com>）

### 3. 部署合约

```bash
cd contracts
cp .env.example .env            # 填入 DEPLOYER_PRIVATE_KEY（测试网私钥）
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast -vv
# 输出含两个合约地址，并写入 deployments/monad-testnet.json
```

验证源码（浏览器验证）：

```bash
forge verify-contract <DREAMSCHEME_ADDR> src/DreamScheme.sol:DreamScheme \
  --chain 10143 --verifier-url https://testnet.monadexplorer.com/api \
  --etherscan-api-key <MONAD_EXPLORER_API_KEY>
# SchemeMarket 同理；也可用 Explorer 网页上传 JSON 源码验证
```

### 4. 配置前端并启动

```bash
cd web
cp .env.example .env.local
# 填入 NEXT_PUBLIC_DREAMSCHEME_ADDRESS / NEXT_PUBLIC_SCHEME_MARKET_ADDRESS
# 可选：PINATA_KEY/PINATA_SECRET（IPFS）、KIMI_API_KEY、NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
# 不填 Pinata/Kimi 时自动进入 local:// 本地演示模式 + 内置规则引擎，全流程可跑通
npm install
npm run dev        # http://localhost:3000
```

### 5. 铸造示例方案（Seed）

```bash
cd web
# .env.local 需含 MONAD_PRIVATE_KEY 与合约地址（seed 也会自动读取 contracts/deployments/*.json）
npm run seed                       # 铸造 3 个原创方案
SEED_REMIX_FROM=1 npm run seed     # 以 #1 为 parentId 铸造 remix（演示谱系与排行榜）
SEED_APPLY_TOKEN=1 npm run seed    # 对 #1 执行一次「应用到我家」（需账户持有 MON）
```

### 6. 完整 Demo 流程

连接 MetaMask（Monad 测试网）→ 领水 → 首页画廊查看方案（事件 + IPFS 元数据）→ 创建页上传/粘贴 JSON
→ 固定到 IPFS → 铸造 NFT → 详情页「应用到我家」（0.01 MON，90/10 自动分账）→「Remix」→ 风格参数编辑器
（主题/调色板/家具数量）→ 铸造 parentId 指向原方案的衍生 NFT → 排行榜热度实时更新。

版本与协作：
- 在**自己的最新版本**详情页点「🚀 发布新版本」→ 铸造 v(N+1)，parentId 指向上一版，详情页版本时间线自动出现 v1/v2/v3。
- 详情页底部「协作讨论」：输入评论 → MetaMask 签名（SIWE 风格）→ 后端 `verifyMessage` 校验 → 写入本地 JSON，**不消耗 gas**。

### 部署信息（URL）

| 项目 | 地址 |
| --- | --- |
| 前端 Demo（本地 / 线上） | `http://localhost:3000`（部署后替换为线上地址，如 `https://<your-app>.vercel.app`） |
| DreamScheme 合约 | `https://testnet.monadexplorer.com/address/<DREAMSCHEME_ADDRESS>` |
| SchemeMarket 合约 | `https://testnet.monadexplorer.com/address/<SCHEME_MARKET_ADDRESS>` |
| Monad 测试网 RPC | <https://testnet-rpc.monad.xyz> |
| 测试币水龙头 | <https://faucet.monad.xyz> |
| 演示视频 | <https://youtu.be/REPLACE_ME> |

> 根目录 `.env.example` 汇总了合约与前端两套环境变量，按注释分别复制到 `contracts/.env` 与 `web/.env.local`。

### 视觉与设计规范

前端整体采用 **Monad 官方风格**，并把「室内设计」的行业语言做成视觉签名。

- **色板**：紫罗兰 `#6E54FF` / 深紫 `#4F47EB` / 李子 `#25043A` / 墨黑 `#0F0F12` / 纸白 `#FBFAF9` / 灰紫 `#727285` / 珊瑚 `#FFA1A1` / 发丝线 `#ECECEC`
- **字体**：自托管 Archivo variable（标题与数字，400–800）+ 中文系统黑体（正文）+ 等宽（地址、哈希、参数）
- **签名元素 · 蓝图标注线**：虚线尺寸线 + 端部刻度 + 等宽数字，直接标注真实数据（房间尺寸、家具数量、谱系深度、分账比例），而不是装饰性图形
- **卡片语言**：`.sheet`（白卡片 + 发丝线）/ `.sheet-dark`（墨黑→李子→紫罗兰渐变，用于 hero 与榜首卡片）；规格表统一「等宽大写小标签 + 右对齐值 + 发丝线分隔」
- **预览图**：`lib/scheme.ts` 的 `schemeToPreviewSvg()` 按平面施工图渲染——标题区、房间平面、家具色块、尺寸标注、调色板，全部由方案 JSON 驱动；`npm run previews` 可批量重新生成
- **移动端**：8 个页面在 390px 宽度下无横向溢出；导航可横向滚动，钱包按钮常驻

### 页面一览

| 路由 | 作用 |
| --- | --- |
| `/` | 方案画廊信息流（SchemeMinted 事件 + IPFS 元数据） |
| `/scheme/[id]` | 方案详情：大图、谱系树、版本时间线、签名评论、应用到我家 / Remix |
| `/create` | 拖拽或粘贴方案 JSON → 参数摘要 → 固定 IPFS → 铸造（parentId = 0） |
| `/remix/[id]` | 风格参数编辑器 → 铸造衍生方案；带 `?newVersion=1` 时指向自己的上一版 |
| `/mint` | 铸造中心：我的铸造统计、可 Remix 机会、我的方案与版本迭代入口 |
| `/trades` | 交易记录：SchemeApplied 全量流水、90/10 分账、我的支出收入与提取 |
| `/board` | 排行榜：热度 = Remix × 2 + 被应用 × 3 |
| `/docs` | 玩法与规则、链上参数、快速上手与 FAQ |

```bash
cd web && npm run previews   # 重新生成 assets/schemes/previews 与 web/public/previews
```

### 演示视频（占位）

[🎥 Demo 视频（占位，录制后替换链接）](https://youtu.be/REPLACE_ME)

---

## 验收标准对照

| 要求 | 状态 | 位置 |
| --- | --- | --- |
| `forge test` 全通过 | ✅ 35/35 | `contracts/test/` |
| DreamScheme（ERC-721+ERC-2981 5%，mint 开放，谱系事件） | ✅ | `contracts/src/DreamScheme.sol` |
| SchemeMarket（applyScheme 90/10 分账 + withdraw） | ✅ | `contracts/src/SchemeMarket.sol` |
| 部署脚本输出地址 | ✅ | `contracts/script/Deploy.s.sol` + `deployments/` |
| `/api/pin`（Pinata，`PINATA_KEY/SECRET`）+ `.env.example` | ✅ | `web/app/api/pin/route.ts` |
| `/api/kimi` 转发 Kimi API | ✅ | `web/app/api/kimi/route.ts` |
| 8 页面（画廊/详情/创建/Remix/铸造中心/交易记录/排行榜/玩法文档），中文移动端自适应 | ✅ | `web/app/**` |
| viem 读事件 + IPFS 元数据（画廊）、谱系树、应用/Remix 按钮 | ✅ | `web/lib/contracts.ts`、`web/components/LineageTree.tsx` |
| `assets/` 3 套示例方案 + 预览图 + seed 脚本 | ✅ | `assets/schemes/`、`web/scripts/seed.ts` |
| 版本管理（链上谱系 v1/v2/v3 时间线） | ✅ | `DreamScheme.versionLineOf` + `web/components/VersionTimeline.tsx` |
| 评论（链下存储 + 钱包签名验证，POST/GET `/api/comment`） | ✅ | `web/app/api/comment/route.ts`、`web/lib/comments.ts` |
| 创建页拖拽上传 JSON + 参数摘要确认 | ✅ | `web/app/create/page.tsx` |
| git 提交 feat/test/docs 分开 | ✅ | 见 `git log` |

## 持续集成（CI）

仓库内置两套流水线，默认都**不需要任何密钥**即可跑通（合约依赖已内置，前端用默认配置构建）：

| 平台 | 文件 | 触发 | 内容 |
| --- | --- | --- | --- |
| Gitee Go（原生） | `.workflow/forge-test.yml` | push / PR 到 `main` | `forge build` + `forge test -vv` + `npm ci && npm run build` |
| GitHub Actions | `.github/workflows/ci.yml` | push / PR 到 `main` | 同上（两个 job 并行，带 npm 缓存） |

启用 Gitee Go：仓库 → **服务 → Gitee Go** → 新建流水线 → 选择 `.workflow/forge-test.yml`。

## 常见问题

- **这个仓库和 `vibecoding_VirtuHome` 的关系**：本仓库是黑客松交付用的独立仓库，只包含 Monad 相关内容；原创业项目的移动端扫描/后端服务在另一个仓库。
- **画廊一直显示演示数据**：`web/.env.local` 未配置合约地址，或部署后未重启 `npm run dev`。
- **铸造按钮报「需要一个 Post-object」类错误**：钱包网络不对，切换到 Monad 测试网（10143）。
- **Pinata 403**：确认 `PINATA_KEY/PINATA_SECRET` 有效；未配置时本地模式使用 `local://` 与 `/api/cid`，不影响演示。
- **Kimi 无返回**：未配置 `KIMI_API_KEY`，此时使用内置规则引擎返回建议。
- **排行榜未更新**：页面每 20s 重新拉取事件与合约状态；也可以在页面刷新。
- **评论发布失败（401）**：签名内容需与提交的 message 完全一致，且 message 必须包含「方案 #tokenId」；重新点击签名发布即可。
- **评论存在哪里**：`web/data/comments/<tokenId>.json`（已 gitignore），可通过 `COMMENTS_DATA_DIR` 改路径。
