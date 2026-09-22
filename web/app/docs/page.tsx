"use client";

import Link from "next/link";
import { dreamSchemeAddress, schemeMarketAddress, APPLY_PRICE } from "@/lib/contracts";
import { formatWeiToMon } from "@/lib/scheme";

const EXPLORER = "https://testnet.monadexplorer.com";

const MECHANISMS = [
  {
    tag: "01",
    title: "铸造即确权",
    body: "每份装修方案 = 一枚 ERC-721。铸造时 creator 上链固化，NFT 转手也不影响作者归因；contentHash 为方案 JSON 的 keccak256，可校验内容未被篡改。"
  },
  {
    tag: "02",
    title: "Remix 谱系",
    body: "任何人都能基于他人方案 Remix：新 NFT 的 parentId 指向来源方案，lineageOf 可回溯完整创作链，形成「家居设计界的 GitHub」。"
  },
  {
    tag: "03",
    title: "版本时间线",
    body: "同一作者迭代自己作品时，parentId 指向自己的上一版，versionLineOf 把同一作者链归组为 v1 / v2 / v3，版本历史清晰可查。"
  },
  {
    tag: "04",
    title: "90 / 10 自动分账",
    body: "他人「应用到我家」支付 0.01 MON：90% 即时转给创作者，10% 累积到平台金库，任何账户可 withdraw()；转售按 ERC-2981 收 5% 版税。"
  },
  {
    tag: "05",
    title: "链下签名评论",
    body: "评论不消耗 gas：前端用 MetaMask 对评论文本签名（SIWE 风格），后端 verifyMessage 校验后按 tokenId 存入本地 JSON，实现零成本的协作讨论。"
  },
  {
    tag: "06",
    title: "IPFS 内容寻址",
    body: "方案 JSON、预览图与 NFT 元数据都固定到 IPFS，链上只存 contentHash 与 URI，保证作品永久可复现、可验证。"
  }
];

export default function DocsPage() {
  const scheme = dreamSchemeAddress();
  const market = schemeMarketAddress();
  const creatorShare = (APPLY_PRICE * 9n) / 10n;
  const platformShare = APPLY_PRICE - creatorShare;

  return (
    <div className="space-y-10">
      <section className="sheet-dark grid-sheet-dark rise relative overflow-hidden px-5 py-9 sm:px-10 sm:py-12">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-violet/25 blur-[90px]"
        />
        <div className="relative">
          <p className="eyebrow eyebrow-dark">Monad Hackathon · Social / Attention / Culture</p>
          <h1 className="display mt-5 text-[34px] text-white sm:text-[52px]">玩法与规则</h1>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-[15px]">
            云筑家把「手机扫描房间 → 3D 虚拟装修」的创业项目接上 Monad：
            <span className="text-white">装修设计方案本身就是可 remix、可归因、可分账的创作资产</span>。
            创作者的每一次迭代、被引用、被应用，都会沉淀为链上注意力资产。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/create" className="btn-primary">
              创建方案
            </Link>
            <Link href="/board" className="btn-outline-light">
              排行榜
            </Link>
            <a
              href="https://faucet.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost-light"
            >
              领测试 MON ↗
            </a>
          </div>
        </div>
      </section>

      <section>
        <p className="eyebrow">Mechanism · 六个机制</p>
        <div className="dim-line mt-4" />
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {MECHANISMS.map((m) => (
            <article key={m.title} className="bg-white p-6 transition hover:bg-paper-2/70">
              <p className="mono text-[10px] tracking-[0.2em] text-violet">{m.tag}</p>
              <h2 className="display-sm mt-3 text-base text-ink">{m.title}</h2>
              <p className="mt-2.5 text-xs leading-relaxed text-muted">{m.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="sheet p-6">
          <p className="eyebrow">Ledger · 分账账本</p>
          <h2 className="display-sm mt-3 text-lg text-ink">一次「应用到我家」</h2>
          <p className="mono mt-2 text-[11px] text-muted">
            PRESET TESTNET PRICE {formatWeiToMon(APPLY_PRICE)} MON
          </p>
          <ul className="mt-5 divide-y divide-hairline border-y border-hairline">
            <li className="flex items-center justify-between py-3">
              <span className="text-[13px] text-muted">创作者即时到账</span>
              <span className="mono text-[13px] font-semibold text-violet-deep">
                {formatWeiToMon(creatorShare)} MON · 90%
              </span>
            </li>
            <li className="flex items-center justify-between py-3">
              <span className="text-[13px] text-muted">平台金库累积（可 withdraw）</span>
              <span className="mono text-[13px] font-semibold text-ink">
                {formatWeiToMon(platformShare)} MON · 10%
              </span>
            </li>
            <li className="flex items-center justify-between py-3">
              <span className="text-[13px] text-muted">二次转售版税（ERC-2981）</span>
              <span className="mono text-[13px] font-semibold text-ink">5%</span>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            创作者为拒收 ETH 的合约时，份额会记入平台代管（事件{" "}
            <code className="mono text-ink">CreatorShareEscrowed</code>），不会卡住应用流程。
          </p>
        </div>

        <div className="sheet p-6">
          <p className="eyebrow">Network · 链上参数</p>
          <h2 className="display-sm mt-3 text-lg text-ink">Monad Testnet</h2>
          <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-[13px]">
            <Row label="Chain ID">
              <span className="mono">10143</span>
            </Row>
            <Row label="原生代币">
              <span className="mono">MON</span>
            </Row>
            <Row label="RPC">
              <a className="link mono text-[12px]" href="https://testnet-rpc.monad.xyz" target="_blank" rel="noreferrer">
                testnet-rpc.monad.xyz ↗
              </a>
            </Row>
            <Row label="水龙头">
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
                <span className="text-muted">未配置（演示数据模式）</span>
              )}
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
                <span className="text-muted">未配置</span>
              )}
            </Row>
          </dl>
        </div>
      </section>

      <section className="sheet p-6 sm:p-8">
        <p className="eyebrow">Quickstart · 3 分钟上手</p>
        <div className="dim-line mt-4" />
        <ol className="mt-6 grid gap-5 sm:grid-cols-2">
          {[
            <>在 MetaMask 添加 Monad 测试网（Chain ID 10143，RPC 见左表）</>,
            <>
              去{" "}
              <a className="link" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
                水龙头
              </a>{" "}
              领取测试 MON
            </>,
            <>
              在 <Link className="link" href="/create">创建页</Link>{" "}
              拖拽/粘贴方案 JSON → 查看参数摘要 → 固定到 IPFS 并铸造
            </>,
            <>
              在 <Link className="link" href="/">画廊</Link>{" "}
              浏览方案，进入详情页点「应用到我家」（0.01 MON，自动 90/10 分账）
            </>,
            <>点「Remix」调整主题/调色板/家具数量，铸造衍生方案（parentId 自动指向原方案）</>,
            <>作者可在自己最新版本上点「发布新版本」，形成 v1/v2/v3 版本时间线</>,
            <>在详情页底部用钱包签名发表评论（零 gas），在 <Link className="link" href="/board">排行榜</Link> 查看热度变化</>
          ].map((li, i) => (
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
        <p className="eyebrow">FAQ · 常见问题</p>
        <div className="dim-line mt-4" />
        <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {[
            {
              q: "铸造和 Remix 要花钱吗？",
              a: "铸造只消耗测试网 gas（MON）；只有「应用到我家」需要支付 0.01 MON，其中 90% 直达创作者。"
            },
            {
              q: "评论为什么不用 gas？",
              a: "评论走链下存储 + 钱包签名验证：MetaMask 对文本签名，后端校验通过后按 tokenId 存到本地 JSON，接口为 POST/GET /api/comment。"
            },
            {
              q: "没配置 Pinata / Kimi 也能演示吗？",
              a: "可以。未配置密钥时自动进入 local:// 本地固定模式，装修建议走内置规则引擎，全流程依然可跑通。"
            },
            {
              q: "方案内容会不会被篡改？",
              a: "不会。contentHash 是方案 JSON 的 keccak256，链上留存；任何人可用 IPFS 内容重新计算并比对。"
            }
          ].map((f) => (
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
