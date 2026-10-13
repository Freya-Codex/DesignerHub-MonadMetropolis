/**
 * Envio HyperIndex 事件处理器 — Designer Hub · Monad
 *
 * 把五个合约的链上事件整理成实体（见 schema.graphql），
 * 前端通过 GraphQL 查询这些实体来驱动 /trades、/scheme/[id]、/board。
 *
 * 运行 `pnpm codegen` 会根据 config.yaml + schema.graphql 生成类型与 context 实体。
 */
import { indexer } from "envio";

const blockNum = (n: number | undefined): bigint => BigInt(n ?? 0);

// ---------------------------------------------------------------- DreamScheme

/** 方案铸造：建 Scheme 实体（含 AI provider 归因 agentId）。 */
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

/** 版税设置：更新 Scheme 的版税接收人 / bps（ERC-2981）。 */
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

/** 方案应用：写一笔交易账本记录，并累加方案的 appliedCount。 */
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

/** 衍生分账：记录付给祖先创作者的份额（血缘变现的可核实凭据）。 */
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

/** Agent 注册：建 Agent 实体（Kimi 等 provider 归因）。 */
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

/** 声誉累加：更新 Agent 声誉并记一条声誉事件（驱动 /board 信誉榜）。 */
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

/** 链上确权：只存承诺（commitment），内容本体始终留在链下。 */
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
