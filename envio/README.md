# Envio HyperIndex — Designer Hub · Monad

把 Designer Hub 五个合约的链上事件索引成可查询的实体，产出 GraphQL 端点，
**驱动前端的核心数据功能**（不是"装了不用"）。

## 它驱动什么

| 前端功能 | 数据来源 | 事件 |
|---|---|---|
| `/trades` 交易账本 | `Trade` 实体 | `SchemeApplied` |
| `/scheme/[id]` 方案详情 + 血缘 | `Scheme` 实体（按 `parentId`） | `SchemeMinted`、`RoyaltySet` |
| 衍生分账凭据 | `AncestorPayout` | `AncestorPaid` |
| `/board` Agent 信誉榜 | `Agent`、`ReputationEvent` | `AgentRegistered`、`ReputationAdded` |
| 链上确权记录 | `Attestation` | `Attested` |

## 为什么需要它（而不是直接用 RPC）

Monad 测试网公共 RPC 把 `eth_getLogs` 限制在 **100 个区块**内，而从部署块
`66892530` 到最新块之间已有**千万级区块**。前端/脚本若自己扫全史，需要上万次请求、
既慢又易缺（现在的 `index-activity.ts` 离线分片正是为此）。Envio **HyperSync**
负责历史回填，**HyperIndex** 把事件整理成实体，前端只查 GraphQL。

## 快速开始

```bash
cd envio
pnpm install          # 或 npm install
pnpm codegen          # 依据 config.yaml + schema.graphql 生成类型
cp .env.example .env  # 填入 ENVIO_API_TOKEN（Envio Cloud 控制台获取）
pnpm dev              # 本地起索引器 + GraphQL（默认 http://localhost:8080）
```

部署到 Envio Cloud（推荐，评审可访问托管端点）：

```bash
pnpm dlx envio@latest deploy
```

## 网络

- **Monad Testnet**，chainId `10143`，start_block `66892530`
- 合约地址见 `config.yaml`（与 `contracts/deployments/monad-testnet.json` 一致）

## 与前端 / Alchemy 的关系

- **Envio** = 读路径 / 索引层：GraphQL 驱动 `/trades`、`/scheme/[id]`、`/board`。
- **Alchemy**（`web/lib/serverRpc.ts`）= 写路径 / RPC 通道：relay 代付、fallback transport。
- 前端保留公共 RPC 兜底：即使 Envio 未部署，站点也不会白屏。
- 索引端点只读、无密钥，不违反仓库 "no secrets in repo" 约定。
