"use client";

import Link from "next/link";
import {
  dreamSchemeAddress,
  schemeMarketAddress,
  agentRegistryAddress,
  provenanceRegistryAddress,
  passkeyFactoryAddress
} from "@/lib/contracts";
import { formatWeiToMon } from "@/lib/scheme";
import { useI18n } from "@/lib/i18n";

const EXPLORER = "https://testnet.monadexplorer.com";

type Mechanism = {
  tag: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
};

const MECHANISMS: Mechanism[] = [
  {
    tag: "01",
    title: "铸造即确权",
    titleEn: "Mint = Proven Ownership",
    body: "每份装修方案 = 一枚 ERC-721。铸造时 creator 上链固化，NFT 转手也不影响作者归因；contentHash 为方案 JSON 的 keccak256，可校验内容未被篡改。",
    bodyEn:
      "Every renovation scheme = one ERC-721. At minting, the creator is committed on-chain, so authorship attribution survives even when the NFT changes hands; contentHash is the keccak256 of the scheme JSON, verifiable against tampering."
  },
  {
    tag: "02",
    title: "Remix 谱系",
    titleEn: "Remix Lineage",
    body: "任何人都能基于他人方案 Remix：新 NFT 的 parentId 指向来源方案，lineageOf 可回溯完整创作链，形成「家居设计界的 GitHub」。",
    bodyEn:
      "Anyone can Remix another’s scheme: the new NFT’s parentId points to the source scheme, and lineageOf traces the full creation chain — the GitHub of home design."
  },
  {
    tag: "03",
    title: "版本时间线",
    titleEn: "Version Timeline",
    body: "同一作者迭代自己作品时，parentId 指向自己的上一版，versionLineOf 把同一作者链归组为 v1 / v2 / v3，版本历史清晰可查。",
    bodyEn:
      "When an author iterates on their own work, parentId points to their previous version, and versionLineOf groups an author’s own versions into v1 / v2 / v3, keeping version history clear and auditable."
  },
  {
    tag: "04",
    title: "创作者定价 · 谱系分账",
    titleEn: "Creator Pricing · Lineage Split",
    body: "创作者用 setPrice 自主定价；他人「应用到我家」按定价支付，原创 90/10、衍生 85/10/5（创作者/平台/祖先谱系）即时分账到账；转售按 ERC-2981 收 5% 版税。",
    bodyEn:
      "Creators set their own price with setPrice; others pay that price to “Apply to My Home”. Original works split 90/10 and derivatives 85/10/5 (creator / platform / ancestor lineage) with instant settlement; resales collect a 5% royalty per ERC-2981."
  },
  {
    tag: "05",
    title: "链下签名评论",
    titleEn: "Off-chain Signed Comments",
    body: "评论不消耗 gas：前端用 MetaMask 对评论文本签名（SIWE 风格），后端 verifyMessage 校验后按 tokenId 存入本地 JSON，实现零成本的协作讨论。",
    bodyEn:
      "Comments cost no gas: the frontend signs the comment text with MetaMask (SIWE style), the backend verifies it with verifyMessage, and it is stored as local JSON keyed by tokenId — zero-cost collaborative discussion."
  },
  {
    tag: "06",
    title: "AI 生成器归因",
    titleEn: "AI Generator Attribution",
    body: "AgentRegistry 注册 AI 生成器（Kimi 预注册为 agentId=1）；mint/remix 携带 agentId 上链，方案与生成它的 AI 可公开归因，声誉随确权次数累积。ProvenanceRegistry 支持 EIP-712 签名存证生成过程。",
    bodyEn:
      "AgentRegistry registers AI generators (Kimi is pre-registered as agentId=1); mint/remix carry agentId on-chain, so a scheme and the AI that generated it are publicly attributable, and reputation accrues with each attestation. ProvenanceRegistry supports EIP-712 signed attestation of the generation process."
  },
  {
    tag: "07",
    title: "Passkey 无助记词账户",
    titleEn: "Passkey Seedless Account",
    body: "主流程：P256PasskeyAccount 用 WebAuthn Passkey（指纹 / Face ID）替代助记词——CREATE2 工厂预计算地址，relayer 代付 gas 执行交易，私钥永不出设备安全芯片；多设备可添加多把公钥。铸造 / Remix / 上架定价均可用 Passkey 免钱包完成；连接钱包（MetaMask）作为备选。入口：/passkey。",
    bodyEn:
      "Main flow: P256PasskeyAccount uses a WebAuthn Passkey (fingerprint / Face ID) instead of a seed phrase — a CREATE2 factory precomputes the address, a relayer pays gas to execute transactions, and the private key never leaves the device’s secure chip; multiple public keys can be added across devices. Minting / Remix / listing for sale can all be done with Passkey, no wallet required; connecting a wallet (MetaMask) is the fallback. Entry: /passkey."
  },
  {
    tag: "08",
    title: "交易账本可查",
    titleEn: "Auditable Transaction Ledger",
    body: "方案 JSON、预览图与 NFT 元数据都固定到 IPFS，链上只存 contentHash 与 URI；所有应用流水按 SchemeApplied 事件沉淀在交易页，可逐笔核对。",
    bodyEn:
      "Scheme JSON, preview images, and NFT metadata are all pinned to IPFS, leaving only contentHash and URI on-chain; all application flow is recorded per SchemeApplied event on the trades page, reconcilable line by line."
  }
];

export default function DocsPage() {
  const { t, lang } = useI18n();
  const scheme = dreamSchemeAddress();
  const market = schemeMarketAddress();
  const price = 10_000_000_000_000_000n; // 0.01 MON 示例
  const creatorShare = (price * 85n) / 100n; // 衍生方案示例
  const platformShare = price / 10n;
  const lineageShare = price - creatorShare - platformShare;

  const quickstart = [
    <>
      {t(
        "在 MetaMask 添加 Monad 测试网（Chain ID 10143，RPC 见左表）（仅连接钱包时需）",
        "Add Monad Testnet in MetaMask (Chain ID 10143; RPC in the table at left) — only needed when connecting a wallet"
      )}
    </>,
    <>
      {t("去", "Go to")}{" "}
      <a className="link" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
        {t("水龙头", "Faucet")}
      </a>{" "}
      {t("领取测试 MON", "and claim test MON")}
    </>,
    <>
      {t("在", "On the")}{" "}
      <Link className="link" href="/mint/create">
        {t("创建页", "Create page")}
      </Link>{" "}
      {t(
        "拖拽/粘贴方案 JSON，或粘贴 base64url 方案码（本站 DesignScheme 或 VirtuHome HomePlan） → 查看参数摘要 → 固定到 IPFS 并铸造",
        " — drag/paste the scheme JSON, or paste a base64url scheme code (this site’s DesignScheme or VirtuHome HomePlan) → review the parameter summary → pin to IPFS and mint"
      )}
    </>,
    <>
      {t("在", "On the")}{" "}
      <Link className="link" href="/demo">
        {t("画廊", "Gallery")}
      </Link>{" "}
      {t(
        "浏览方案，进入详情页点「应用到我家」（按创作者定价支付，自动分账）",
        "page, browse schemes, open a detail page, and click “Apply to My Home” (pay the creator’s price, auto-split)"
      )}
    </>,
    <>
      {t(
        "点「Remix」调整主题/调色板/家具数量，铸造衍生方案（parentId 自动指向原方案）",
        "Click “Remix” to adjust theme / palette / furniture count, then mint a derivative (parentId automatically points to the source scheme)"
      )}
    </>,
    <>
      {t("在", "On the")}{" "}
      <Link className="link" href="/mint">
        {t("铸造", "Mint")}
      </Link>{" "}
      {t("页查看自己的铸造记录与被衍生次数", "page, view your minting records and derivative count")}
    </>,
    <>
      {t("在", "On the")}{" "}
      <Link className="link" href="/trades">
        {t("交易", "Trades")}
      </Link>{" "}
      {t(
        "页查看应用流水与 90/10 分账，提取待领份额",
        "page, view the application flow and the 90/10 split, and watch shares settle instantly"
      )}
    </>,
    <>
      {t(
        "作者可在自己最新版本上点「发布新版本」，形成 v1/v2/v3 版本时间线",
        "Authors can click “Publish new version” on their latest version to build a v1 / v2 / v3 timeline"
      )}
    </>,
    <>
      {t(
        "在详情页底部用钱包签名发表评论（零 gas），在",
        "At the bottom of the detail page, sign a comment with your wallet (zero gas), and see trending changes on the"
      )}{" "}
      <Link className="link" href="/board">
        {t("排行榜", "Leaderboard")}
      </Link>
      {t("查看热度变化", ".")}
    </>
  ];

  const faq = [
    {
      q: t("铸造和 Remix 要花钱吗？", "Do minting and Remix cost money?"),
      a: t(
        "用 Passkey 时铸造 / Remix / 上架定价完全免 gas（relayer 代付）；「应用到我家」按创作者 setPrice 定价支付，原创 90% 直达创作者。",
        "With Passkey, minting / Remix / listing for sale are entirely gas-free (the relayer pays); “Apply to My Home” pays at the creator’s setPrice, and 90% of an original goes directly to the creator."
      )
    },
    {
      q: t("Passkey 会碰我的资金吗？", "Does Passkey touch my funds?"),
      a: t(
        "不会。Passkey 密钥不接触资金，支付密钥由用户自选：Passkey 只用于身份与签名（铸造 / Remix / 上架定价），不托管、不触碰你的资金；涉及付款（应用到我家）时，用哪种支付方式与密钥由用户自行选择。",
        "No. A passkey is used only for identity and signatures (minting / Remix / listing for sale); it never custodies or moves your funds. For payments (Apply to My Home), the choice of payment method and key is entirely yours."
      )
    },
    {
      q: t("评论为什么不用 gas？", "Why don’t comments cost gas?"),
      a: t(
        "评论走链下存储 + 钱包签名验证：MetaMask 对文本签名，后端校验通过后按 tokenId 存到本地 JSON，接口为 POST/GET /api/comment。",
        "Comments use off-chain storage plus wallet signature verification: MetaMask signs the text, and after backend verification it is stored as local JSON keyed by tokenId, via POST and GET on /api/comment."
      )
    },
    {
      q: t("方案码（base64url）是什么？", "What is a scheme code (base64url)?"),
      a: t(
        "把方案压成一段 base64url 码，便于分享/搬运。创建页「方案码」页签可直接粘贴解析：既支持本站 DesignScheme，也支持云筑家 VirtuHome 的 HomePlan（自动转换）。也可在 JSON 模式下点「复制方案码」把当前方案导出为码。",
        "It compresses a scheme into a base64url string for easy sharing / transfer. The Create page’s “Scheme code” tab parses pasted codes directly: it supports both this site’s DesignScheme and VirtuHome’s HomePlan (auto-converted). In JSON mode you can also click “Copy scheme code” to export the current scheme as a code."
      )
    },
    {
      q: t("没配置 Pinata / Kimi 也能演示吗？", "Can I demo without configuring Pinata / Kimi?"),
      a: t(
        "可以。未配置密钥时自动进入 local:// 本地固定模式，装修建议走内置规则引擎，全流程依然可跑通。",
        "Yes. With no keys configured, it automatically falls back to local pinning mode (local://), and renovation suggestions use the built-in rules engine — the whole flow still works end to end."
      )
    },
    {
      q: t("方案内容会不会被篡改？", "Can scheme content be tampered with?"),
      a: t(
        "不会。contentHash 是方案 JSON 的 keccak256，链上留存；任何人可用 IPFS 内容重新计算并比对。",
        "No. contentHash is the keccak256 of the scheme JSON, stored on-chain; anyone can recompute it from the IPFS content and compare."
      )
    }
  ];

  return (
    <div className="space-y-10">
      <section className="sheet-dark grid-sheet-dark rise relative overflow-hidden px-5 py-9 sm:px-10 sm:py-12">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-violet/25 blur-[90px]"
        />
        <div className="relative">
          <p className="eyebrow eyebrow-dark">Monad Hackathon · Track 04 — Trust, Identity & AI Infrastructure</p>
          <h1 className="display mt-5 text-[34px] text-white sm:text-[52px]">
            {t("玩法与规则", "Mechanics & Rules")}
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-[15px]">
            {t(
              "在「云筑家 VirtuHome」网站里完成「AI生成装修方案」，将方案导入这里，变成",
              "On the VirtuHome site you create “AI-generated renovation schemes”, then import them here and turn them into "
            )}
            <span className="text-white">
              {t("可 remix、可归因、可分账的创作资产", "creative assets that are remixable, attributable, and revenue-sharing")}
            </span>
            {t("。创作者的每一次迭代、被引用、被应用，都会沉淀为链上注意力资产。", ". Every iteration, citation, and application by a creator settles into an on-chain attention asset.")}
          </p>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-white/60">
            <span className="text-white">
              {t("Passkey 密钥不接触资金，支付密钥由用户自选。", "Passkey keys never touch funds; the payment key is yours to choose.")}
            </span>{" "}
            {t(
              "Passkey 只用于身份与签名，不托管、不触碰你的资金；涉及付款时，用哪种支付方式与密钥由你自行选择。",
              "Passkey is used only for identity and signatures; it never custodies or moves your funds. For payments, the choice of method and key is yours."
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/passkey" className="btn-primary">
              {t("用 Passkey 登录（主流程）", "Sign in with Passkey (main flow)")}
            </Link>
            <Link href="/mint/create" className="btn-outline-light">
              {t("创建方案", "Create Scheme")}
            </Link>
            <Link href="/board" className="btn-outline-light">
              {t("排行榜", "Leaderboard")}
            </Link>
            <a
              href="https://faucet.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost-light"
            >
              {t("领测试 MON ↗", "Get Test MON ↗")}
            </a>
          </div>
        </div>
      </section>

      <section>
        <p className="eyebrow">{t("Mechanism · 八个机制", "Mechanisms")}</p>
        <div className="dim-line mt-4" />
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {MECHANISMS.map((m) => {
            const title = lang === "en" ? m.titleEn : m.title;
            const body = lang === "en" ? m.bodyEn : m.body;
            return (
              <article key={m.title} className="bg-white p-6 transition hover:bg-paper-2/70">
                <p className="mono text-[10px] tracking-[0.2em] text-violet">{m.tag}</p>
                <h2 className="display-sm mt-3 text-base text-ink">{title}</h2>
                <p className="mt-2.5 text-xs leading-relaxed text-muted">{body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="sheet p-6">
          <p className="eyebrow">{t("Ledger · 分账账本", "Ledger")}</p>
          <h2 className="display-sm mt-3 text-lg text-ink">{t("一次「应用到我家」", "One “Apply to My Home”")}</h2>
          <p className="mono mt-2 text-[11px] text-muted">
            EXAMPLE PRICE {formatWeiToMon(price)} MON
          </p>
          <ul className="mt-5 divide-y divide-hairline border-y border-hairline">
            <li className="flex items-center justify-between py-3">
              <span className="text-[13px] text-muted">{t("创作者即时到账", "Creator (instant)")}</span>
              <span className="mono text-[13px] font-semibold text-violet-deep">
                {formatWeiToMon(creatorShare)} MON · 85%
              </span>
            </li>
            <li className="flex items-center justify-between py-3">
              <span className="text-[13px] text-muted">{t("平台（即时到账）", "Platform (instant)")}</span>
              <span className="mono text-[13px] font-semibold text-ink">
                {formatWeiToMon(platformShare)} MON · 10%
              </span>
            </li>
            <li className="flex items-center justify-between py-3">
              <span className="text-[13px] text-muted">{t("祖先谱系池（衍生方案）", "Ancestor lineage pool (derivatives)")}</span>
              <span className="mono text-[13px] font-semibold text-ink">
                {formatWeiToMon(lineageShare)} MON · 5%
              </span>
            </li>
            <li className="flex items-center justify-between py-3">
              <span className="text-[13px] text-muted">{t("二次转售版税（ERC-2981）", "Secondary resale royalty (ERC-2981)")}</span>
              <span className="mono text-[13px] font-semibold text-ink">5%</span>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {t("衍生方案的应用收入会沿", "Application revenue from a derivative sends 5% up the ")}
            <code className="mono text-ink">parentId</code>
            {t("谱系向所有祖先创作者均分 5%（事件", " lineage to all ancestor creators (event ")}
            <code className="mono text-ink">AncestorPaid</code>
            {t("），原创的 remix 价值持续回流。原创方案无祖先池，创作者拿 90%。", "), so value from remixes keeps flowing back to the originals. An original scheme has no ancestor pool, so its creator takes 90%.")}
          </p>
        </div>

        <div className="sheet p-6">
          <p className="eyebrow">{t("Network · 链上参数", "Network")}</p>
          <h2 className="display-sm mt-3 text-lg text-ink">Monad Testnet</h2>
          <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-[13px]">
            <Row label="Chain ID">
              <span className="mono">10143</span>
            </Row>
            <Row label={t("原生代币", "Native token")}>
              <span className="mono">MON</span>
            </Row>
            <Row label="RPC">
              <a className="link mono text-[12px]" href="https://testnet-rpc.monad.xyz" target="_blank" rel="noreferrer">
                testnet-rpc.monad.xyz ↗
              </a>
            </Row>
            <Row label={t("水龙头", "Faucet")}>
              <a className="link mono text-[12px]" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
                faucet.monad.xyz ↗
              </a>
            </Row>
            <Row label="DreamScheme">
              {scheme ? (
                <a
                  className="link mono text-[11px]"
                  href={`${EXPLORER}/address/${scheme}`}
                  target="_blank"
                  rel="noreferrer"
                  title={scheme}
                >
                  {scheme.slice(0, 10)}…{scheme.slice(-6)} ↗
                </a>
              ) : (
                <span className="text-muted">{t("未配置（演示数据模式）", "Not configured (demo data mode)")}</span>
              )}
            </Row>
            <Row label="AgentRegistry">
              {(() => {
                const a = agentRegistryAddress();
                return a ? (
                  <a className="link mono text-[11px]" href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer" title={a}>
                    {a.slice(0, 10)}…{a.slice(-6)} ↗
                  </a>
                ) : (
                  <span className="text-muted">{t("未配置", "Not configured")}</span>
                );
              })()}
            </Row>
            <Row label="ProvenanceRegistry">
              {(() => {
                const a = provenanceRegistryAddress();
                return a ? (
                  <a className="link mono text-[11px]" href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer" title={a}>
                    {a.slice(0, 10)}…{a.slice(-6)} ↗
                  </a>
                ) : (
                  <span className="text-muted">{t("未配置", "Not configured")}</span>
                );
              })()}
            </Row>
            <Row label="PasskeyAccountFactory">
              {(() => {
                const a = passkeyFactoryAddress();
                return a ? (
                  <a className="link mono text-[11px]" href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer" title={a}>
                    {a.slice(0, 10)}…{a.slice(-6)} ↗
                  </a>
                ) : (
                  <span className="text-muted">{t("未配置", "Not configured")}</span>
                );
              })()}
            </Row>
            <Row label="SchemeMarket">
              {market ? (
                <a
                  className="link mono text-[11px]"
                  href={`${EXPLORER}/address/${market}`}
                  target="_blank"
                  rel="noreferrer"
                  title={market}
                >
                  {market.slice(0, 10)}…{market.slice(-6)} ↗
                </a>
              ) : (
                <span className="text-muted">{t("未配置", "Not configured")}</span>
              )}
            </Row>
          </dl>

          <details className="group mt-5 rounded-xl border border-hairline bg-paper-2/50 p-4 list-none [&::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer select-none items-center gap-2 text-[12px] font-medium text-ink">
              <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {t("Contract addresses · 完整合约地址", "Contract addresses")}
              </span>
              <span className="ml-auto text-[11px] text-muted group-open:hidden">{t("展开 ▾", "Expand ▾")}</span>
              <span className="ml-auto hidden text-[11px] text-muted group-open:inline">{t("收起 ▴", "Collapse ▴")}</span>
            </summary>
            <div className="mt-3 space-y-1.5 border-t border-hairline pt-3">
              <p className="mono text-[11px] leading-relaxed text-ink">
                DreamScheme{" "}
                <span className="break-all">{scheme ?? t("未配置（演示数据模式）", "Not configured (demo data mode)")}</span>
              </p>
              <p className="mono text-[11px] leading-relaxed text-ink">
                SchemeMarket{" "}
                <span className="break-all">{market ?? t("未配置（仅画廊可读）", "Not configured (gallery read-only)")}</span>
              </p>
            </div>
          </details>
        </div>
      </section>

      <section className="sheet p-6 sm:p-8">
        <p className="eyebrow">{t("Quickstart · 3 分钟上手", "Quickstart")}</p>
        <div className="dim-line mt-4" />
        <ol className="mt-6 grid gap-5 sm:grid-cols-2">
          {quickstart.map((li, i) => (
            <li key={i} className="flex gap-4">
              <span className="mono shrink-0 text-[11px] leading-6 text-violet">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] leading-6 text-ink">{li}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="sheet p-6 sm:p-8">
        <p className="eyebrow">{t("FAQ · 常见问题", "FAQ")}</p>
        <div className="dim-line mt-4" />
        <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="text-[13px] font-semibold text-ink">{f.q}</dt>
              <dd className="mt-2 text-xs leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
