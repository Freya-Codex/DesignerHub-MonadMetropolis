/**
  * Envio HyperIndex event handlers -- Designer Hub · Monad
 *
  * Organize the on-chain events of the five contracts into entities (see schema.graphql);
  * the front end queries these entities over GraphQL to drive /trades, /scheme/[id], and /board.
 *
  * Running `pnpm codegen` generates types and the context entity from config.yaml + schema.graphql.
 */
import { indexer } from "envio";

const blockNum = (n: number | undefined): bigint => BigInt(n ?? 0);

// ---------------------------------------------------------------- DreamScheme

/** Scheme mint: create a Scheme entity (with the AI provider attribution agentId). */
indexer.onEvent(
  { contract: "DreamScheme", event: "SchemeMinted" },
  async ({ event, context }) => {
    const id = event.params.tokenId.toString();
    const existing = await context.Scheme.get(id);
    context.Scheme.set({
      id,
      creator: event.params.creator,
      parentId: event.params.parentId,
      contentHash: event.params.contentHash,
      agentId: event.params.agentId,
      mintedBlock: blockNum(event.block.number),
      mintedTx: event.transaction?.hash ?? "",
      appliedCount: existing?.appliedCount ?? 0,
      royaltyReceiver: existing?.royaltyReceiver ?? undefined,
      royaltyBps: existing?.royaltyBps ?? undefined
    });
  }
);

/** Royalty set: update the Scheme's royalty receiver / bps (ERC-2981). */
indexer.onEvent(
  { contract: "DreamScheme", event: "RoyaltySet" },
  async ({ event, context }) => {
    const id = event.params.tokenId.toString();
    const scheme = await context.Scheme.get(id);
    if (!scheme) return;
    context.Scheme.set({
      ...scheme,
      royaltyReceiver: event.params.receiver,
      royaltyBps: event.params.feeNumerator
    });
  }
);

// --------------------------------------------------------------- SchemeMarket

/** Scheme apply: write a trade-ledger record and increment the scheme's appliedCount. */
indexer.onEvent(
  { contract: "SchemeMarket", event: "SchemeApplied" },
  async ({ event, context }) => {
    const tokenId = event.params.tokenId.toString();
    const id = `${event.transaction?.hash ?? ""}-${event.logIndex}`;
    context.Trade.set({
      id,
      scheme_id: tokenId,
      tokenId: event.params.tokenId,
      applier: event.params.applier,
      creator: event.params.creator,
      price: event.params.price,
      creatorCut: event.params.creatorCut,
      platformCut: event.params.platformCut,
      blockNumber: blockNum(event.block.number),
      txHash: event.transaction?.hash ?? "",
      logIndex: event.logIndex
    });

    const scheme = await context.Scheme.get(tokenId);
    if (scheme) {
      context.Scheme.set({ ...scheme, appliedCount: scheme.appliedCount + 1 });
    }
  }
);

/** Derivative split: record the share paid to ancestor creators (verifiable proof of lineage monetization). */
indexer.onEvent(
  { contract: "SchemeMarket", event: "AncestorPaid" },
  async ({ event, context }) => {
    context.AncestorPayout.set({
      id: `${event.transaction?.hash ?? ""}-${event.logIndex}`,
      tokenId: event.params.tokenId,
      ancestor: event.params.ancestor,
      amount: event.params.amount,
      blockNumber: blockNum(event.block.number),
      txHash: event.transaction?.hash ?? ""
    });
  }
);

// ------------------------------------------------------------- AgentRegistry

/** Agent register: create an Agent entity (provider attribution such as Kimi). */
indexer.onEvent(
  { contract: "AgentRegistry", event: "AgentRegistered" },
  async ({ event, context }) => {
    const id = event.params.agentId.toString();
    const existing = await context.Agent.get(id);
    context.Agent.set({
      id,
      owner: event.params.owner,
      metadataURI: event.params.metadataURI,
      reputation: existing?.reputation ?? 0n,
      registeredBlock: blockNum(event.block.number)
    });
  }
);

/** Reputation increment: update the agent's reputation and record a reputation event (drives the /board leaderboard). */
indexer.onEvent(
  { contract: "AgentRegistry", event: "ReputationAdded" },
  async ({ event, context }) => {
    const agentId = event.params.agentId.toString();
    context.ReputationEvent.set({
      id: `${event.transaction?.hash ?? ""}-${event.logIndex}`,
      agent_id: agentId,
      newReputation: event.params.newReputation,
      delta: event.params.delta,
      blockNumber: blockNum(event.block.number),
      txHash: event.transaction?.hash ?? ""
    });

    const agent = await context.Agent.get(agentId);
    if (agent) {
      context.Agent.set({ ...agent, reputation: event.params.newReputation });
    } else {
      context.Agent.set({
        id: agentId,
        owner: "0x0000000000000000000000000000000000000000",
        metadataURI: "",
        reputation: event.params.newReputation,
        registeredBlock: blockNum(event.block.number)
      });
    }
  }
);

// --------------------------------------------------------- ProvenanceRegistry

/** On-chain attestation: only the commitment is stored; the content body always stays off-chain. */
indexer.onEvent(
  { contract: "ProvenanceRegistry", event: "Attested" },
  async ({ event, context }) => {
    context.Attestation.set({
      id: `${event.transaction?.hash ?? ""}-${event.logIndex}`,
      commitment: event.params.commitment,
      attestor: event.params.attestor,
      agentId: event.params.agentId,
      metadataURI: event.params.metadataURI,
      blockNumber: blockNum(event.block.number),
      txHash: event.transaction?.hash ?? ""
    });
  }
);
