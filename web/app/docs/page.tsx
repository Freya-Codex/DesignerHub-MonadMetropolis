"use client";

import Link from "next/link";
import { dreamSchemeAddress, schemeMarketAddress, APPLY_PRICE } from "@/lib/contracts";
import { formatWeiToMon } from "@/lib/scheme";

const EXPLORER = "https://testnet.monadexplorer.com";

const MECHANISMS = [
  {
    icon: "⛏",
    title: "铸造即确权",
    body: "每份装修方案 = 一枚 ERC-721。铸造时 creator 上链固化，NFT 转手也不影响作者归因；contentHash 为方案 JSON 的 keccak256，可校验内容未被篡改。"
  },
  {
    icon: "🔁",
    title: "Remix 谱系",
    body: "任何人都能基于他人方案 Remix：新 NFT 的 parentId 指向来源方案，lineageOf 可回溯完整创作链，形成「家居设计界的 GitHub」。"
  },
  {
    icon: "🧬",
    title: "版本时间线",
    body: "同一作者迭代自己作品时，parentId 指向自己的上一版，versionLineOf 把同一作者链归组为 v1 / v2 / v3，版本历史清晰可查。"
  },
  {
    icon: "💰",
    title: "90 / 10 自动分账",
    body: "他人「应用到我家」支付 0.01 MON：90% 即时转给创作者，10% 累积到平台金库，任何账户可 withdraw()；转售按 ERC-2981 收 5% 版税。"
  },
  {
    icon: "💬",
    title: "链下签名评论",
    body: "评论不消耗 gas：前端用 MetaMask 对评论文本签名（SIWE 风格），后端 verifyMessage 校验后按 tokenId 存入本地 JSON，实现零成本的协作讨论。"
  },
  {
    icon: "🪐",
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
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-zinc-900 bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-900 p-6 text-white sm:p-9">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          Monad 黑客松 · Social / Attention / Culture
        </span>
        <h1 className="mt-4 text-2xl font-black sm:text-3xl">玩法与规则</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
          云筑家把「手机扫描房间 → 3D 虚拟装修」的创业项目接上 Monad：
          <b className="text-white">装修设计方案本身就是可 remix、可归因、可分账的创作资产</b>。
          创作者的每一次迭代、被引用、被应用都会沉淀为链上注意力资产。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/create" className="btn-primary">✨ 创建方案</Link>
          <Link href="/board" className="btn-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
            🏆 排行榜
          </Link>
          <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="btn-ghost !text-emerald-300 hover:!bg-white/10">
            💧 领测试 MON
          </a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MECHANISMS.map((m) => (
          <div key={m.title} className="card p-5">
            <div className="text-xl">{m.icon}</div>
            <h2 className="mt-2 text-sm font-bold text-zinc-900">{m.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{m.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-zinc-900">💰 一次「应用到我家」的账本</h2>
          <p className="mt-1 text-xs text-zinc-500">预设 testnet 价格 {formatWeiToMon(APPLY_PRICE)} MON</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
              <span>创作者即时到账</span>
              <b className="text-emerald-600">{formatWeiToMon(creatorShare)} MON（90%）</b>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
              <span>平台金库累积（可 withdraw）</span>
              <b className="text-indigo-600">{formatWeiToMon(platformShare)} MON（10%）</b>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
              <span>二次转售版税（ERC-2981）</span>
              <b className="text-zinc-700">5%</b>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            创作者为拒收 ETH 的合约时，份额会记入平台代管（事件 <code className="rounded bg-zinc-100 px-1">CreatorShareEscrowed</code>），
            不会卡住应用流程。
          </p>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-zinc-900">🪐 链上参数</h2>
          <dl className="mt-3 space-y-2 text-xs text-zinc-600">
            <div className="flex justify-between gap-3">
              <dt>网络</dt><dd className="font-semibold text-zinc-800">Monad Testnet</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Chain ID</dt><dd className="font-mono">10143</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>原生代币</dt><dd>MON</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>RPC</dt>
              <dd><a className="text-indigo-600 underline" href="https://testnet-rpc.monad.xyz" target="_blank" rel="noreferrer">testnet-rpc.monad.xyz</a></dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>水龙头</dt>
              <dd><a className="text-indigo-600 underline" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">faucet.monad.xyz</a></dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>DreamScheme</dt>
              <dd className="truncate font-mono">
                {scheme ? (
                  <a className="text-indigo-600 underline" href={`${EXPLORER}/address/${scheme}`} target="_blank" rel="noreferrer">
                    {scheme}
                  </a>
                ) : (
                  "未配置（当前为演示数据模式）"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>SchemeMarket</dt>
              <dd className="truncate font-mono">
                {market ? (
                  <a className="text-indigo-600 underline" href={`${EXPLORER}/address/${market}`} target="_blank" rel="noreferrer">
                    {market}
                  </a>
                ) : (
                  "未配置"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-900">🚀 3 分钟上手</h2>
        <ol className="mt-3 space-y-2 text-sm text-zinc-700">
          <li><b>1.</b> 在 MetaMask 添加 Monad 测试网（Chain ID 10143，RPC 见上表）</li>
          <li><b>2.</b> 去 <a className="text-indigo-600 underline" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">水龙头</a> 领取测试 MON</li>
          <li><b>3.</b> 在 <Link className="text-indigo-600 underline" href="/create">创建页</Link> 拖拽/粘贴方案 JSON → 查看参数摘要 → 固定到 IPFS 并铸造</li>
          <li><b>4.</b> 在 <Link className="text-indigo-600 underline" href="/">画廊</Link> 浏览方案，进入详情页点「应用到我家」（0.01 MON，自动 90/10 分账）</li>
          <li><b>5.</b> 点「Remix」调整主题/调色板/家具数量，铸造衍生方案（parentId 自动指向原方案）</li>
          <li><b>6.</b> 作者可在自己最新版本上点「发布新版本」，形成 v1/v2/v3 版本时间线</li>
          <li><b>7.</b> 在详情页底部用钱包签名发表评论（零 gas），在 <Link className="text-indigo-600 underline" href="/board">排行榜</Link> 查看热度变化</li>
        </ol>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-900">❓ 常见问题</h2>
        <dl className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-600">
          <div>
            <dt className="font-semibold text-zinc-800">铸造和 Remix 要花钱吗？</dt>
            <dd>铸造只消耗测试网 gas（MON）；只有「应用到我家」需要支付 0.01 MON，其中 90% 直达创作者。</dd>
          </div>
          <div>
            <dt className="font-semibold text-zinc-800">评论为什么不用 gas？</dt>
            <dd>评论走链下存储 + 钱包签名验证：MetaMask 对文本签名，后端校验通过后按 tokenId 存到本地 JSON，接口为 <code className="rounded bg-zinc-100 px-1">POST/GET /api/comment</code>。</dd>
          </div>
          <div>
            <dt className="font-semibold text-zinc-800">没配置 Pinata / Kimi 也能演示吗？</dt>
            <dd>可以。未配置密钥时自动进入 <code className="rounded bg-zinc-100 px-1">local://</code> 本地固定模式，装修建议走内置规则引擎，全流程依然可跑通。</dd>
          </div>
          <div>
            <dt className="font-semibold text-zinc-800">方案内容会不会被篡改？</dt>
            <dd>不会。contentHash 是方案 JSON 的 keccak256，链上留存；任何人可用 IPFS 内容重新计算并比对。</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
