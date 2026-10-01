# Designer Hub · Monad — 项目简介

> **把「生成式内容」变成链上可署名、可 Remix、可即时分账的创作资产——一套面向开发者的身份 / 溯源 / 数据所有权 / 代理信任原语。**

- **赛道**：**Track 04 — Trust, Identity & AI Infrastructure**
- **网络**：Monad Testnet（chainId `10143`）
- **交付物**：5 份已部署合约 + 前端应用 + 类型化 SDK（`@yunzhujia/sdk`）+ 集成文档（Track 04 要求的「原语」形态）
- **本简介按比赛评分标准（Technical 20% / Design 20% / Originality 15% / Market 25% / Traction 20%）逐项组织**

---

## 〇、为什么这属于 Track 04

官方对 Track 04 的定义：**「AI has made identity, provenance, data ownership, and agent trust urgent infrastructure problems」**，面向 **AI-native internet 的协议级原语**（proof of personhood / content passports / data lockers），适合「comfortable with cryptography, protocol design, or agent frameworks」的团队；并且明确要求这是**别的应用可以在其上构建的原语，而不是一个独立的消费级产品**。

Designer Hub 与这条赛道逐点对应，且**全部以「可被第三方集成的原语」形态交付**（含 SDK 与集成文档，而非只是一个 App）：

| Track 04 关键词 | 本项目对应的原语 |
| --- | --- |
| **Identity（身份）** | `P256PasskeyAccount` + `PasskeyAccountFactory`——WebAuthn/P-256 无种子智能账户，私钥不出设备安全芯片 |
| **Provenance（溯源）** | `ProvenanceRegistry`——只上链内容承诺 `keccak256(contentHash ‖ salt)`，内容本体永不上链；`DreamScheme` 记录链上谱系 |
| **Data ownership（数据所有权）** | 谱系与分账在链上、不锁在单一平台数据库；无平台金库 |
| **Agent trust（代理信任）** | `AgentRegistry`——AI 生成器注册 + 声誉 + 链上 `agentId` 归因 |
| **「原语而非产品」** | 交付 `@yunzhujia/sdk` + `docs/INTEGRATING.md`，第三方可脱离我们的 UI 直接构建 |
| **cryptography / protocol design / agent frameworks** | 真实 P-256 + WebAuthn 链上验签、CREATE2 账户协议、AI agent 注册表 |

---

## 一、问题

生成式内容（设计稿、3D 资产、预设、AI 产出）在扩散和二次创作中，**署名、溯源、收益**三件事同时失灵：

1. 作品被 Remix / 复用后，原创者拿不到任何收益，也无法证明「谁先做的」；
2. 归属记录锁在**单个平台的数据库**里——平台能改、能冻结、能清零，创作者被平台俘获；
3. AI 参与生成后，**哪个模型产出了什么**没有中立、可审计的记录；
4. 用户侧的「身份」要么是托管账号，要么是一串助记词——流失率高、责任重。

现有做法只是把问题**换个地方中心化**：多一个平台金库、多一份私有数据库。

---

## 二、方案：三层可组合原语

Designer Hub 不是「一个 App」，而是一组**可被第三方集成**的链上原语，全部已在 Monad 测试网运行：

| 原语 | 合约 | 提供什么 |
| --- | --- | --- |
| **Passkey 身份** | `P256PasskeyAccount` + `PasskeyAccountFactory` | 无助记词智能账户。地址 = `CREATE2(x, y, rpIdHash, originHash)`；私钥永驻设备安全芯片（Secure Enclave / StrongBox / TPM）；链上验证**真实 WebAuthn 断言**，challenge 绑定 `account ‖ chainId ‖ nonce ‖ to ‖ value ‖ keccak256(data)`，因此**任何 relayer 都能代付 gas 却无法篡改调用**。 |
| **溯源 / 数据所有权** | `ProvenanceRegistry` | 只上链内容承诺 `keccak256(contentHash ‖ salt)`（**内容本体永不上链**），附时间戳与 AI agentId。隐私优先的存证。支持 EOA 直连 `attest` 或 `attestByRelayer`（EIP-712 授权）。 |
| **可 Remix 的资产 + 谱系** | `DreamScheme` + `SchemeMarket` | ERC-721 资产，链上 `parentId` 记录谱系（v1→v2→v3 时间线）；创作者用 `setPrice` 自主定价；被「应用到我家」时**即时分账**——原创 **90/10**，衍生 **85/10/5**（创作者 / 平台 / 祖先谱系池），**无平台金库、无 `withdraw()`**；转售遵循 ERC-2981（5% 版税）。`AgentRegistry` 记录 AI 生成器（Kimi 预注册 `agentId = 1`）与声誉，使「方案 + 生成它的模型」公开可归因。 |

主流程用 Passkey（指纹 / Face ID 登录，用户无需持有 MON，relayer 代付 gas）；MetaMask 保留为「高级模式」。

---

## 三、对照评分标准

### 1. Technical Execution — 20%
**要求**：信任 / 身份 / 数据原语实现正确且安全——WebAuthn/P256 使用正确、密钥派生合理、无密钥泄漏。

- 链上验证**真实 WebAuthn 断言**；纯 Solidity P-256 回退实现（探测 RIP-7212 `0x100` 预编译，缺失时回退 Jacobian 运算）→ 在 Monad 等无预编译链上同样可用。
- **密钥派生**：`CREATE2(x, y, rpIdHash, originHash)`，反事实地址可在部署前展示；每账户最多 4 把 key（`addKey`）支持多设备恢复。
- **防篡改**：challenge 绑定完整 calldata 摘要 + nonce，relayer 无法改参数、无法改收款人。
- **无密钥泄漏**：仓库内只有公钥 / 测试夹具；`docs/SECURITY.md` 给出威胁模型与密钥处理与 secret 扫描说明。
- **测试与实测**：Foundry **96 个用例全通过**；真实测试网 E2E 已跑通（部署 tx `0x5d5c3d9b…`、execute tx `0xd7ef914c…`，含 `Attested` 事件）。

**证据**：`contracts/test/*`（96 cases）· `docs/SECURITY.md`

### 2. Design & Craft（开发者体验）— 20%
**要求**：对「要基于它开发的开发者」可用——文档清晰、接口/API 干净，**即便没有面向终端用户的 UI**。

- 类型化 SDK **`@yunzhujia/sdk`**（可构建、已通过类型检查，challenge 向量与链上交叉校验），三档集成路径：
  - **只读**（无钱包无密钥，2 分钟）；
  - **标准钱包 EOA**（mint / setPrice / apply）；
  - **Passkey 账户**（无助记词 + 可选 gas 代付）。
- 文档：`docs/INTEGRATING.md`（集成指南 + 采用方 + 「为什么不自己造」+ gas 赞助边界 + 赛后计划）、`sdk/README.md`（API 参考 + 示例）、内置 `/docs` 页面。
- 可直接运行：`npx tsx sdk/examples/read-schemes.ts`。

**证据**：`sdk/`（typed、buildable）· `docs/INTEGRATING.md` · `sdk/README.md`

### 3. Originality & Track Insight — 15%
**要求**：以**隐私优先、且不被单一平台俘获**的方式解决信任 / 溯源 / 数据所有权，而不是换个姿势中心化。（对应 Track 04 的 provenance / data ownership / AI-native 原语）

- **隐私优先**：`ProvenanceRegistry` 只存承诺哈希，内容本体永不上链。
- **不被俘获**：
  - **无平台金库**——收款在**同一笔交易内**直达创作者 / 平台 / 祖先，没有可冻结的余额；
  - **谱系在链上，不在数据库**——归属不依赖任何单一 App；
  - **relayer 是无许可、可替换的**——`execute(...)` 任何人都可调用，**签名才是授权**，demo relayer 只是便利，不是依赖；
  - **身份属于用户**——密钥在用户设备安全芯片里，非托管。

**证据**：`docs/INTEGRATING.md` §"Why it isn't capturable" · `docs/SECURITY.md`（relayer 信任模型）

### 4. Founder & Market Readiness — 25%（最高权重）
**要求**：清楚**哪些具体应用 / 开发者会采用**，以及**为什么不自己造**。

**目标采用方**（`docs/INTEGRATING.md`）：

| 采用方 | 为什么用而不是自研 |
| --- | --- |
| **生成式 / 设计工具**（如云筑家 App 本身） | 直接获得链上归因 + 收益分账，无需自己写 WebAuthn/P256 验证、CREATE2 账户与谱系分账逻辑。 |
| **内容市场 / 资产库**（3D 资产、户型图、预设） | 即插即用 passkey 登录（无种子短语、转化率更高）+ 可执行的转售版税与 Remix 谱系。 |
| **AI agent 平台 / 模型与数据方** | `AgentRegistry` + `ProvenanceRegistry` 提供「哪个模型产出了什么」的中立链上记录，用于审计、争议与声誉（Track 04 的 agent trust 场景）。 |
| **身份 / 钱包 SDK** | P-256 WebAuthn 账户 + 纯 Solidity 验证器的参考实现（可在无 RIP-7212 预编译的链上跑）。 |

**自己造意味着重写**：WebAuthn 断言解析 + P-256 验证（EC2 COSE key、DER→(r,s)、low-s/边界）、带重放安全 nonce 的 CREATE2 账户、防篡改 challenge 方案、存证注册表、谱系感知的分账器——约一周安全敏感工作；SDK 把它压缩成几个类型化调用。

**第一方集成方已就位**：云筑家 App（`virtu-home`）导出方案 JSON 即可接入。

### 5. Traction & Path Forward — 20%
**要求**：有开发者兴趣证据（哪怕黑客松期间**一个别的团队**接入），以及**具体的**赛后集成计划。

- **现状（如实）**：目前**自用 E2E 已跑通，尚无第三方集成**；这一点不夸大。集成所需的「接口」已就绪（SDK + 指南 + 可运行示例）。
- **赛后计划**（`docs/INTEGRATING.md` §Roadmap，具体可执行）：
  1. **交付套件**（已完成）：发布 `@yunzhujia/sdk` + 指南 + 示例；
  2. **赛事期间落地一个集成方**：云筑家 App 为第一方集成者；招募**一个外部团队**（设计工具 / 资产库 / AI agent 平台）通过 SDK 完成 mint/attest——**只读集成也算**；
  3. **赛后**：开设小额集成赏金 / "built on Designer Hub" 赛道，新增 `builtWith` 注册表，并托管 Demo（Demo URL + 录制视频）；
  4. **后续**：relayer 计量 / 付费中继、`AgentRegistry` 的按 agent 分析、为「承诺 + 谱系」模式提 EIP 草案。

---

## 四、现状与诚实缺口（提交前优先项）

| 项 | 状态 |
| --- | --- |
| 5 份合约部署 + 96 测试 + 测试网 E2E | ✅ 完成 |
| SDK / 集成文档 / 安全文档 | ✅ 完成 |
| 第三方集成证据 | ⚠️ **未达成**——需招募第二个团队（最高优先） |
| 线上 Demo URL / 演示视频 | ⚠️ **未完成**——README 仍为 `youtu.be/REPLACE_ME` |

---

## 五、部署信息（Monad Testnet · chainId 10143）

| 合约 | 地址 |
| --- | --- |
| `DreamScheme` | `0x2541eB7A4AC7bb5287A5944452576f983b3dc3eB` |
| `SchemeMarket` | `0xD89a267605B7c3Ee9B172aB58b735686b3b0DC64` |
| `AgentRegistry` | `0x9EB3d5C336c66823577F4FBB1E31dbABcf7c268D` |
| `ProvenanceRegistry` | `0xCe41D2fa11fC3944662b783ac895D3380B8B09ED` |
| `PasskeyAccountFactory` | `0x41E72cc140b30891b34Da45f3ed55a525c758C76` |

- 部署块 `66892530` · Kimi `agentId = 1` · 平台 / 部署者 `0x33DD409d85115E300B4570EeB6D4DA7eF1605D08`
- 浏览器 <https://testnet.monadexplorer.com> · RPC `https://testnet-rpc.monad.xyz` · 水龙头 <https://faucet.monad.xyz>

---

## 六、延伸阅读

| 文档 | 内容 |
| --- | --- |
| [`README.md`](../README.md) | 架构、合约、路由、快速开始 |
| [`docs/INTEGRATING.md`](./INTEGRATING.md) | 原语、采用方、「为什么不自己造」、集成路径、gas 代付、赛后计划 |
| [`docs/SECURITY.md`](./SECURITY.md) | 威胁模型、P-256/WebAuthn 正确性、relayer 信任、密钥处理 |
| [`docs/JUDGING-ALIGNMENT.md`](./JUDGING-ALIGNMENT.md) | 逐项对照评分标准（证据 / 缺口 / 行动） |
| [`sdk/README.md`](../sdk/README.md) | SDK API 参考与示例 |
