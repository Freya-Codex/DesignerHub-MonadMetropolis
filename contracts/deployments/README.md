# 部署记录

运行部署脚本后，这里会生成当前链的部署信息（例如 `monad-testnet.json`）：

```json
{
  "network": "monad-testnet",
  "chainId": 10143,
  "deployer": "0x...",
  "platformAddress": "0x...",
  "DreamScheme": "0x...",
  "SchemeMarket": "0x..."
}
```

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast -vv
```

把输出的两个地址填入 `web/.env.local`：

```
NEXT_PUBLIC_DREAMSCHEME_ADDRESS=0x...
NEXT_PUBLIC_SCHEME_MARKET_ADDRESS=0x...
```
