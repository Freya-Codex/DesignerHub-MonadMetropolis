# 部署记录

运行部署脚本后，这里会生成当前链的部署信息（例如 `monad-testnet.json`）：

```json
{
  "network": "monad-testnet",
  "chainId": 10143,
  "deployer": "0x...",
  "platformAddress": "0x...",
  "kimiAgentId": 1,
  "DreamScheme": "0x...",
  "SchemeMarket": "0x...",
  "AgentRegistry": "0x...",
  "ProvenanceRegistry": "0x...",
  "PasskeyAccountFactory": "0x..."
}
```

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast -vv
```

把输出的五个地址填入 `web/.env.local`：

```
NEXT_PUBLIC_DREAM_SCHEME_ADDRESS=0x...
NEXT_PUBLIC_SCHEME_MARKET_ADDRESS=0x...
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_PROVENANCE_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_PASSKEY_FACTORY_ADDRESS=0x...
```

> 历史（旧版）地址见根 `README.md` 的「历史部署」章节，存档于本地 `monad-testnet-v1.json`（被 `.gitignore` 覆盖）。
