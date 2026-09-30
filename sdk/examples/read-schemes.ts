/**
 * Example: read schemes from Monad Testnet with no wallet and no API key.
 *
 *   npx tsx examples/read-schemes.ts
 */

import { monadTestnet, publicClient, readScheme, readTotalSupply } from "../src/index.js";

async function main() {
  const client = publicClient();
  const total = await readTotalSupply(client);
  console.log(`Monad Testnet ${monadTestnet.dreamScheme} → totalSupply = ${total}`);

  const last = total > 0n ? total : 0n;
  for (let id = last; id > 0n && id > last - 5n; id--) {
    const s = await readScheme(client, id);
    console.log(
      `#${s.tokenId} creator=${s.creator} parent=${s.parentId} agent=${s.agentId} ` +
        `remixes=${s.remixCount} applied=${s.appliedCount} price=${s.priceWei}wei`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
