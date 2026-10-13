# Alchemy 集成说明（服务端数据层）

Designer Hub 把 Alchemy 作为 **服务端数据层**：RPC（读链/索引）与 Webhooks（事件推送）。
**前端保持零密钥**——所有 Alchemy 访问都发生在 Next.js 服务端路由/脚本里。

## 为什么放在服务端

- `NEXT_PUBLIC_*` 会被内联进前端 bundle → 等于公开。因此 Alchemy Key **只用 `ALCHEMY_API_KEY`**（无前缀）。
- 前端（wagmi / `publicClientFor` / 浏览器尾部扫描）继续走公共 RPC `https://testnet-rpc.monad.xyz`，
  维持「单文件、无依赖、零密钥」的公开叙事。
- 服务端统一通过 `web/lib/serverRpc.ts` 取得 transport：**Alchemy 优先，公共 RPC 自动回退**
  （viem `fallback`），因此即使 Alchemy 未开通该网络或临时限流，站点也不会整体挂掉。

## 环境变量（`web/.env.example`）

| 变量 | 作用 |
| --- | --- |
| `ALCHEMY_API_KEY` | Alchemy API Key（**服务端专用**，勿加 `NEXT_PUBLIC_`）：`https://monad-testnet.g.alchemy.com/v2/<key>` |
| `ALCHEMY_RPC_URL` | 可选，直接指定 RPC URL（优先于上面的 Key 拼接） |
| `ALCHEMY_MONAD_HOST` | 可选，覆盖主机前缀（默认 `https://monad-testnet.g.alchemy.com/v2`） |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | 可选，Alchemy Webhook 签名密钥（配置后强制校验回调签名） |

> ⚠️ 首次使用需在 Alchemy Dashboard 的对应 App 里 **启用 MONAD_TESTNET 网络**，否则会返回
> `MONAD_TESTNET is not enabled for this app`（此时会自动回退公共 RPC）。

## 代码落点

- `web/lib/serverRpc.ts` — `serverRpcUrl() / serverTransport() / serverPublicClient() / usingAlchemy()`；Key 只在此读取。
- `web/app/api/relay/route.ts` — 代付 relayer 的服务端节点改走 `serverTransport()`；`GET` 会返回 `rpcProvider / rpcLabel`。
- `web/scripts/index-activity.ts` — 离线索引器改走 `serverTransport()`；有 Alchemy 时分片自适应放大（默认 2000 区块，公共 RPC 为 100）。
- `web/app/api/alchemy/webhook/route.ts` — Alchemy Address Activity 接收端：校验 `X-Alchemy-Signature`（HMAC-SHA256），
  解码 `SchemeMinted` / `SchemeApplied`，增量落盘到 `data/activity-webhooks.json`（运行时，已忽略入库）。
- `web/app/api/activity/route.ts` — 合并离线索引 `data/activity.json` 与 Webhook 增量 `data/activity-webhooks.json`。

## Webhook 配置

1. Alchemy Dashboard → Webhooks → 新建 **Address Activity** Webhook，网络选 Monad Testnet，
   地址填五个合约（DreamScheme / SchemeMarket / AgentRegistry / ProvenanceRegistry / PasskeyAccountFactory）。
2. 回调 URL 填 `https://<你的域名>/api/alchemy/webhook`。
3. 复制 Signing Key 填入 `ALCHEMY_WEBHOOK_SIGNING_KEY`（不填则不校验签名，仅用于联调）。

## 离线索引（可选）

```bash
cd web
npm run index                 # 头部 20000 + 尾部 20000 区块
INDEX_FULL=1 npm run index    # 部署块 → 最新块（最完整）
```

有 Alchemy 时会自动使用更大的 `eth_getLogs` 区间，请求数与耗时显著下降。

## 安全边界

- Alchemy Key 只存在于 `web/.env.local`（`.gitignore` 已忽略），**不入库、不进前端**。
- Webhook 接收端在配置签名密钥后，未签名/错误签名的请求一律 `401`。
