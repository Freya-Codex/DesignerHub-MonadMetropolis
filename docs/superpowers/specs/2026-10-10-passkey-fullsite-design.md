# Spec · Passkey 全站化（Designer Hub · Monad）

- 日期：2026-10-10
- 状态：已批准（设计中「整体 OK」）
- 目标：让 **Passkey 用户全站无需钱包**（铸造成交主线），并把顶栏从「Passkey 介绍 + 高级模式钱包按钮」收敛为「单一 Passkey 控件」。

## 背景与约束

站点为 Monad 测试网 DApp（Next.js 14，`web/`）。身份/签名有两条路：

1. **Passkey**（主）：`P256PasskeyAccount` 智能账户。地址由工厂 `accountOf(x,y,rpIdHash,originHash)` 经 CREATE2 推导；私钥不出设备安全芯片；交易经 `/api/relay` 由 relayer **代付 gas**（`value` 恒为 0）。
2. **MetaMask**（备选/高级）：EOA，直连合约，自付 gas。

### 关键约束（代码确认）

- relay `execute` 现**硬性禁止带 value**（`value_must_be_zero`，「relayer 不代转 ETH/MON」）。
- `applyScheme` 是 **payable**（付 `price` MON）→ passkey 无法代付。
- 因此本方案采用 **A：付费购买保持钱包专属**，其余可 gasless 的全部 passkey 化。

## 设计

### ① 顶栏重构（`components/Header.tsx`）

- 移除右上角「高级模式」小字与 RainbowKit `ConnectButton`。
- 右上角改为**单一 Passkey 控件**，按状态显示：
  - 未创建 →「创建通行密钥」→ 跳 `/passkey`
  - 已创建 → `Passkey · 0x…（短地址）` + 部署状态圆点 → 点击进 `/passkey`
- 导航移除 `Passkey` 项（入口即右上角控件），保留：`画廊 · 铸造 · 交易 · 排行榜 · 文档`。
- MetaMask 连接移入 `/passkey` 页作为**备选项**（「已有钱包？连接 MetaMask」）。
- Header 需感知 passkey 状态：`lib/passkeyAccount.ts` 在 save/clear 时派发 `dh:passkey-changed` 事件，Header 监听 + 路由变化时重读 localStorage。

### ② Passkey 覆盖 Remix 与上架定价

- 复用 `executeViaPasskey({ to, data })`（内部处理「未部署先由 relayer 部署」）。
- `app/remix/[id]/page.tsx`：`const useMetaMask = isConnected; const usePasskey = !isConnected && Boolean(pk);`。passkey 分支用 `encodeFunctionData(dreamSchemeAbi, "remix", [tokenId, contentHash, KIMI_AGENT_ID, tokenUri])` 经 passkey 执行。
- `app/scheme/[id]/page.tsx`：**上架 / 改定价**（`setPrice`）对「passkey 自有方案」开放（`ownerOf == passkey 地址`）。
- **「应用到我家」（购买）保持钱包专属**：passkey 用户点击 → 提示「付费需连接钱包」。
- `/trades` 为只读流水，无需改动。

### ③ 文档更新

- 删除「MetaMask（高级模式）」措辞，统一为「Passkey 主流程 / 连接钱包为备选」。
- 新增说明（用户指定原文）：

  > **Passkey 密钥不接触资金，支付密钥由用户自选。** Passkey 只用于身份与签名（铸造 / Remix / 上架定价），不托管、不触碰你的资金；涉及付款（应用到我家）时，用哪种支付方式与密钥由用户自行选择。

### ④ 验证

- `npm run build` 通过。
- E2E（全新 Chrome）：passkey gasless **Remix** 与 **setPrice** 各跑通一次。

## 影响面

| 文件 | 改动 |
|---|---|
| `components/Header.tsx` | 顶栏 Passkey 控件，去 ConnectButton/高级模式 |
| `lib/passkeyAccount.ts` | 派发 `dh:passkey-changed`；供多页复用 |
| `app/passkey/page.tsx` | 内含「连接 MetaMask（备选）」 |
| `app/remix/[id]/page.tsx` | passkey Remix 分支 |
| `app/scheme/[id]/page.tsx` | passkey setPrice 分支；购买提示 |
| `app/mint/create/page.tsx` | 文案：高级模式 → 连接钱包（备选） |
| `app/docs/page.tsx` | 文案 + 新声明 |

## 非目标（YAGNI）

- 不改合约、不改 relay 的 `value_must_be_zero`。
- 不给 passkey 账户做充值入口。
- 评论（EIP-191 签名）本期不动，仍为钱包签名。
