# Deployment records

After running the deploy script, the deployment info for the current chain is written here
(for example `monad-testnet.json`):

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

Fill the five printed addresses into `web/.env.local`:

```
NEXT_PUBLIC_DREAM_SCHEME_ADDRESS=0x...
NEXT_PUBLIC_SCHEME_MARKET_ADDRESS=0x...
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_PROVENANCE_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_PASSKEY_FACTORY_ADDRESS=0x...
```

> Historical (old) addresses are listed in the root `README.md` under "Historical deployments",
> archived locally as `monad-testnet-v1.json` (covered by `.gitignore`).
