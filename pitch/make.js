/* Designer Hub · Monad — pitch deck (HTML -> PPTX) · v3 premium dark Web3 system */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const PptxGenJS = require('pptxgenjs');
const html2pptx = require('./html2pptx.js');

const ROOT = __dirname;
const ASSETS = path.join(ROOT, 'assets');
const SLIDES_DIR = path.join(ROOT, 'slides');
const MONAD = path.resolve(__dirname, '..');
const SHOTS = path.join(MONAD, 'docs/screenshots');
fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(SLIDES_DIR, { recursive: true });

const C = {
  bg: '#0A0912', panel: '#141220', panel2: '#1C1930', line: '#2A2740', line2: '#3A3560',
  ink: '#FFFFFF', body: '#C7C3D9', mute: '#8E89A8', faint: '#6C6884',
  accent: '#8B7CFF', accent2: '#5B4BE0', cyan: '#5AD2E6', lime: '#A9E86B', coral: '#FF9BA6', gold: '#F4C860'
};

/* ---------------- raster assets ---------------- */
async function genAssets() {
  const mesh = (gs) => `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <defs>
      ${gs.map((g, i) => `<radialGradient id="g${i}" cx="${g.x}" cy="${g.y}" r="${g.r}">
        <stop offset="0%" stop-color="${g.c}" stop-opacity="${g.o}"/><stop offset="100%" stop-color="${g.c}" stop-opacity="0"/>
      </radialGradient>`).join('')}
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M60 0H0V60" fill="none" stroke="#FFFFFF" stroke-opacity="0.035" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="1920" height="1080" fill="${C.bg}"/>
    <rect width="1920" height="1080" fill="url(#grid)"/>
    ${gs.map((g, i) => `<rect width="1920" height="1080" fill="url(#g${i})"/>`).join('')}
  </svg>`;
  const A1 = [{ c: C.accent2, x: '82%', y: '10%', r: '58%', o: '0.42' }, { c: '#2B2A6E', x: '12%', y: '96%', r: '55%', o: '0.35' }];
  const COVER = [{ c: '#6E54FF', x: '74%', y: '30%', r: '62%', o: '0.5' }, { c: '#3B2EA8', x: '40%', y: '100%', r: '60%', o: '0.4' }, { c: C.cyan, x: '96%', y: '88%', r: '42%', o: '0.16' }];
  const STAT = [{ c: C.accent2, x: '50%', y: '118%', r: '70%', o: '0.4' }, { c: '#2B2A6E', x: '100%', y: '0%', r: '50%', o: '0.3' }];
  await sharp(Buffer.from(mesh(A1))).png().toFile(path.join(ASSETS, 'bg.png'));
  await sharp(Buffer.from(mesh(COVER))).png().toFile(path.join(ASSETS, 'bg-cover.png'));
  await sharp(Buffer.from(mesh(STAT))).png().toFile(path.join(ASSETS, 'bg-stat.png'));

  // cover collage: tilted desktop + two phones
  const desk = await sharp(path.join(SHOTS, '01-home.png')).resize({ width: 600 }).toBuffer();
  const dMeta = await sharp(desk).metadata();
  const p1 = await sharp(path.join(SHOTS, '07-mobile-home.png')).resize({ width: 165 }).toBuffer();
  const p2 = await sharp(path.join(SHOTS, '08-mobile-remix.png')).resize({ width: 165 }).toBuffer();
  const deskR = await sharp(desk).rotate(-7, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const p1R = await sharp(p1).rotate(9, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const p2R = await sharp(p2).rotate(-11, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: 1000, height: 780, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: deskR, left: 60, top: 150 },
      { input: p1R, left: 560, top: 330 },
      { input: p2R, left: 700, top: 130 }
    ]).png().modulate({ brightness: 0.8, saturation: 0.82 }).toFile(path.join(ASSETS, 'collage.png'));

  // white (transparent) wordmark for dark backgrounds
  async function whiteMark(src, dst) {
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0; i < info.width * info.height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      out[i * 4] = 255; out[i * 4 + 1] = 255; out[i * 4 + 2] = 255;
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(255 - lum)));
    }
    await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(dst);
  }
  await whiteMark(path.join(MONAD, 'web/public/logo-light.png'), path.join(ASSETS, 'logo.png'));
  await whiteMark(path.join(MONAD, 'web/public/mark.png'), path.join(ASSETS, 'mark.png'));

  // icons
  const ICONS = {
    shield: '<path d="M12 3l7 3v5.5c0 4.8-3.2 8-7 9-3.8-1-7-4.2-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17.5 12v3M20.5 12v2"/>',
    network: '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M10.3 10.3L6.5 6.5M13.7 10.3l3.8-3.8M10.3 13.7l-3.8 3.8M13.7 13.7l3.8 3.8"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><rect x="10.4" y="10.4" width="3.2" height="3.2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V8a4 4 0 018 0v2"/>',
    bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 6.5a3 3 0 010 5.5M18 20c0-2.4-.9-4.6-2.4-6"/>',
    rocket: '<path d="M5.5 15c-1.2 1.6-1.5 3.5-1.5 5 1.5 0 3.4-.3 5-1.5M9 14.5l-3-3c2.4-5.2 6.3-8.5 11.5-8.5 0 5.2-3.3 9.1-8.5 11.5z"/><circle cx="14.5" cy="9.5" r="1.6"/>',
    target: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r="0.7"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c3 3.2 3 14 0 17.2M12 3.4c-3 3.2-3 14 0 17.2"/>',
    scale: '<path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 005 0zM19 8l-2.5 6a3 3 0 005 0z"/>',
    spark: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 5H6a2 2 0 00-2 2v10"/>'
  };
  for (const [k, d] of Object.entries(ICONS)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    await sharp(Buffer.from(svg)).resize(160, 160).png().toFile(path.join(ASSETS, `ic-${k}.png`));
  }
}
const A = (f) => path.join(ASSETS, f);
const S = (f) => path.join(SHOTS, f);
const ic = (n) => A(`ic-${n}.png`);
const ul = (items) => `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;

/* ---------------- css ---------------- */
const BASE = `
*{box-sizing:border-box;margin:0;padding:0;}
html{background:${C.bg};}
body{width:720pt;height:405pt;font-family:Arial,Helvetica,sans-serif;color:${C.body};background:${C.bg};background-image:url('file://__BG__');background-size:cover;display:flex;overflow:hidden;}
.wrap{width:100%;height:100%;padding:30pt 46pt 16pt 46pt;display:flex;flex-direction:column;}
.eyebrow{font-family:'Courier New',monospace;font-size:9.5pt;letter-spacing:2.2px;color:${C.accent};text-transform:uppercase;margin-bottom:8pt;}
h1{font-size:31pt;line-height:1.06;font-weight:bold;color:${C.ink};letter-spacing:-0.4pt;margin-bottom:16pt;}
h2{font-size:13pt;font-weight:bold;color:${C.ink};margin-bottom:3pt;line-height:1.2;}
p{font-size:12.5pt;line-height:1.45;color:${C.body};}
ul{margin:0;padding-left:13pt;}
li{font-size:12.5pt;line-height:1.42;color:${C.body};margin-bottom:6pt;}
.mono{font-family:'Courier New',monospace;font-size:9pt;letter-spacing:0.6px;color:${C.mute};}
.card{background:${C.panel};border:1px solid ${C.line};border-radius:10pt;padding:13pt 15pt;}
.card h2{font-size:12.5pt;margin-bottom:4pt;}
.card p{font-size:12pt;line-height:1.42;color:#B9B5CC;}
.pl{border-left:3pt solid ${C.accent};}
.chip{width:34pt;height:34pt;border-radius:8pt;background:${C.panel2};border:1px solid ${C.line2};display:flex;align-items:center;justify-content:center;margin-bottom:9pt;}
.chip img{width:19pt;height:19pt;}
.num{font-family:'Courier New',monospace;font-size:9pt;letter-spacing:1.4px;color:${C.accent};margin-bottom:6pt;}
.big{font-size:42pt;font-weight:bold;color:${C.ink};line-height:0.98;letter-spacing:-1.2pt;}
.kpi{font-family:'Courier New',monospace;font-size:8.5pt;letter-spacing:1.4px;color:${C.mute};margin-top:6pt;}
.foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${C.line};padding-top:6pt;margin-top:auto;}
.foot p{font-family:'Courier New',monospace;font-size:8pt;letter-spacing:0.8px;color:${C.faint};}
.row{display:flex;}
.grow{flex:1;}
.growrow{flex:1;display:flex;align-items:center;}
.mid{display:flex;flex-direction:column;justify-content:center;}
.dim{display:block;width:150pt;height:6pt;margin:-6pt 0 14pt 0;}
.shot{border:1px solid ${C.line2};border-radius:8pt;background:${C.panel};padding:4pt;}
.shot img{width:100%;display:block;border-radius:6pt;}
`;

const frame = (inner, pg, bg = 'bg.png') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE.replace('__BG__', A(bg))}</style></head><body><div class="wrap">${inner}
<div class="foot"><p>DESIGNER HUB</p><p>${pg} / 13</p></div>
</div></body></html>`;

const slides = [];

/* 1 · cover */
slides.push({ name: 'cover', html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE.replace('__BG__', A('bg-cover.png'))}
html,body{background-image:url('file://${A('bg-cover.png')}');background-size:cover;}
.wrap{padding:32pt 46pt 22pt 46pt;}
.top{display:flex;justify-content:space-between;align-items:center;}
.top p{font-family:'Courier New',monospace;font-size:8.5pt;letter-spacing:1.6px;color:${C.mute};}
h1{font-size:52pt;line-height:1;letter-spacing:-1.6pt;margin-bottom:9pt;}
.tag{font-size:17pt;color:${C.accent};margin-bottom:11pt;}
.sub{font-size:12pt;color:#B9B5CC;max-width:330pt;line-height:1.5;}
.meta{display:flex;border-top:1px solid ${C.line2};padding-top:10pt;}
.meta p{font-family:'Courier New',monospace;font-size:8.5pt;letter-spacing:1.2px;color:${C.mute};margin-right:20pt;}
</style></head><body><div class="wrap">
<div class="top"><img src="${A('logo.png')}" style="width:150pt;height:auto;"><p>TRACK 04 · TRUST, IDENTITY &amp; AI INFRASTRUCTURE</p></div>
<div class="row" style="flex:1;align-items:center;">
  <div style="width:53%;padding-right:14pt;">
    <h1>Designer&nbsp;Hub</h1>
    <p class="tag">A GitHub for home design.</p>
    <p class="sub">Export a scheme. Mint it as an on-chain asset. Remix it, keep your name on it, and get paid when it is used.</p>
  </div>
  <div style="width:47%;display:flex;justify-content:flex-end;">
    <img src="${A('collage.png')}" style="width:112%;height:auto;transform:translate(6%,-2%);">
  </div>
</div>
<div class="meta"><p>MONAD TESTNET</p><p>5 CONTRACTS</p><p>96 TESTS</p><p>2-MIN PITCH</p></div>
</div></body></html>` });

/* 2 · founder */
slides.push({ name: 'founder', html: frame(`
<p class="eyebrow">Founder</p>
<h1>Designer first, builder second.</h1>
<div class="growrow">
  <div class="card pl" style="width:300pt;margin-right:20pt;">
    <p class="num">FOUNDER</p>
    <h2 style="font-size:16pt;margin-bottom:2pt;">榮 (Rong)</h2>
    <p class="mono" style="margin-bottom:9pt;">DESIGNER + FULL-STACK BUILDER</p>
    ${ul([
      'OCADU — Interior Design',
      'UCL — MArch, Architecture',
      'GAD · AECOM — practice',
      'Founder — 云筑家 VirtuHome'
    ])}
  </div>
  <div class="grow">
    <div class="card" style="margin-bottom:11pt;display:flex;align-items:center;">
      <img src="${ic('layers')}" style="width:22pt;height:22pt;margin-right:12pt;">
      <div><h2>Domain authority</h2><p>I know what a scheme is worth — and who pays for it.</p></div>
    </div>
    <div class="card" style="margin-bottom:11pt;display:flex;align-items:center;">
      <img src="${ic('spark')}" style="width:22pt;height:22pt;margin-right:12pt;">
      <div><h2>Lived the problem</h2><p>My own work was remixed with no trace back.</p></div>
    </div>
    <div class="card" style="display:flex;align-items:center;">
      <img src="${ic('rocket')}" style="width:22pt;height:22pt;margin-right:12pt;">
      <div><h2>Shipped it solo</h2><p>The contracts, the app and the typed SDK.</p></div>
    </div>
  </div>
</div>`, '02') });

/* 3 · problem */
slides.push({ name: 'problem', html: frame(`
<p class="eyebrow">The Problem</p>
<h1>Generative design has no authorship.</h1>
<div class="row" style="margin-bottom:13pt;">
  <div class="card" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('copy')}"></div><h2>Remix, no recourse</h2><p>Copied and reused — the original earns nothing.</p></div>
  <div class="card" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('lock')}"></div><h2>Locked in a silo</h2><p>Attribution lives in one database — freezable.</p></div>
  <div class="card" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('cpu')}"></div><h2>AI, no record</h2><p>No neutral proof of which model made what.</p></div>
  <div class="card" style="width:24.25%;"><div class="chip"><img src="${ic('key')}"></div><h2>Identity churns</h2><p>Custodial accounts or seed phrases — high friction.</p></div>
</div>
<div class="growrow">
  <div class="card pl" style="width:100%;padding:16pt 18pt;"><p style="font-size:14pt;color:#E4E1F2;">Today's fixes just re-centralize the problem — one more vault, one more private database.</p></div>
</div>`, '03') });

/* 4 · why */
slides.push({ name: 'why', html: frame(`
<p class="eyebrow">Why We're Building It</p>
<h1>I've been on the losing side of this.</h1>
<div class="growrow">
  <div style="width:56%;padding-right:22pt;">
    <p style="font-size:13.5pt;line-height:1.56;">As a designer, my schemes were remixed with no trace back. As a founder, my 云筑家 users hit the same wall.</p>
    <p style="font-size:13.5pt;line-height:1.56;margin-top:10pt;">Creative work needs a settlement layer — and it has to be <b style="color:#fff;">a primitive</b>, not a feature of one app.</p>
  </div>
  <div class="grow">
    <div class="card pl" style="margin-bottom:10pt;"><p class="num">BET 01</p><p style="color:#E4E1F2;">Provenance matters as much as generation.</p></div>
    <div class="card pl" style="margin-bottom:10pt;"><p class="num">BET 02</p><p style="color:#E4E1F2;">Ownership belongs on-chain, not in a database.</p></div>
    <div class="card pl"><p class="num">BET 03</p><p style="color:#E4E1F2;">Attribution is what creators pay for.</p></div>
  </div>
</div>`, '04') });

/* 5 · solution */
slides.push({ name: 'solution', html: frame(`
<p class="eyebrow">The Solution</p>
<h1>Four primitives. Live on Monad.</h1>
<div class="row" style="margin-bottom:13pt;">
  <div class="card pl" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('key')}"></div><p class="num">IDENTITY</p><h2>Passkey Account</h2><p>No seed phrase. The key never leaves the secure element.</p></div>
  <div class="card pl" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('shield')}"></div><p class="num">PROVENANCE</p><h2>ProvenanceRegistry</h2><p>Only a commitment hash goes on-chain. Content stays off.</p></div>
  <div class="card pl" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('cube')}"></div><p class="num">ASSETS</p><h2>DreamScheme + Market</h2><p>ERC-721 lineage, creator pricing, instant splits.</p></div>
  <div class="card pl" style="width:24.25%;"><div class="chip"><img src="${ic('network')}"></div><p class="num">AGENT TRUST</p><h2>AgentRegistry</h2><p>Every mint records the AI that made it.</p></div>
</div>
<div class="growrow">
  <div class="card" style="width:100%;padding:16pt 18pt;display:flex;align-items:center;"><img src="${ic('code')}" style="width:22pt;height:22pt;margin-right:12pt;"><p style="font-size:13pt;color:#E4E1F2;">Packaged as a typed SDK so any design tool, marketplace or agent platform can build on it — <b style="color:#fff;">without our UI</b>.</p></div>
</div>`, '05') });

/* 6 · how it works + economics donut */
slides.push({ name: 'how', html: frame(`
<p class="eyebrow">How It Works</p>
<h1>One scheme JSON in. A living asset out.</h1>
<div class="row" style="margin-bottom:14pt;">
  <div class="card" style="width:19%;margin-right:1.25%;padding:11pt 12pt;"><p class="num">01</p><p style="font-size:11pt;">Export from 云筑家</p></div>
  <div class="card" style="width:19%;margin-right:1.25%;padding:11pt 12pt;"><p class="num">02</p><p style="font-size:11pt;">Pin to IPFS</p></div>
  <div class="card" style="width:19%;margin-right:1.25%;padding:11pt 12pt;"><p class="num">03</p><p style="font-size:11pt;">Mint ERC-721</p></div>
  <div class="card" style="width:19%;margin-right:1.25%;padding:11pt 12pt;"><p class="num">04</p><p style="font-size:11pt;">Remix (parentId)</p></div>
  <div class="card" style="width:19%;padding:11pt 12pt;"><p class="num">05</p><p style="font-size:11pt;">Apply → split</p></div>
</div>
<div class="growrow">
  <div style="width:52%;padding-right:16pt;">
    <h2 style="font-size:13.5pt;margin-bottom:8pt;">Revenue, enforced by the contract</h2>
    ${ul([
      'Original → <b style="color:#fff;">90 / 10</b> (creator / platform)',
      'Remix → <b style="color:#fff;">85 / 10 / 5</b> (creator / platform / lineage)',
      'Resale royalty <b style="color:#fff;">5%</b> · heat = remixes ×2 + applies ×3'
    ])}
    <p class="mono" style="margin-top:6pt;">Splits settle in the same transaction — no vault to freeze.</p>
  </div>
  <div style="width:48%;display:flex;justify-content:center;align-items:center;">
    <div class="placeholder" id="split" style="width:200pt;height:150pt;"></div>
  </div>
</div>`, '06') });

/* 7 · technical */
slides.push({ name: 'technical', html: frame(`
<p class="eyebrow">Rubric 01 · Technical Execution — 20%</p>
<h1>Real WebAuthn, verified on-chain.</h1>
<div class="growrow">
  <div style="width:60%;padding-right:16pt;">
    ${ul([
      'The chain verifies a real WebAuthn assertion; the challenge binds the calldata, so a relayer pays gas but <b style="color:#fff;">cannot tamper</b>.',
      'CREATE2 address from <b style="color:#fff;">(x, y, rpIdHash, originHash)</b>; up to 4 keys for recovery.',
      'Pure-Solidity P-256 fallback → runs without the RIP-7212 precompile.',
      'No secrets in the repo; threat model in docs/SECURITY.md.'
    ])}
  </div>
  <div style="width:40%;padding-left:10pt;display:flex;flex-direction:column;justify-content:center;">
    <div class="card" style="margin-bottom:10pt;padding:14pt 16pt;"><p class="big">96</p><p class="kpi">FOUNDRY TESTS PASSING</p></div>
    <div class="card" style="margin-bottom:10pt;padding:14pt 16pt;"><p class="big">5</p><p class="kpi">CONTRACTS LIVE ON MONAD</p></div>
    <div class="card" style="padding:14pt 16pt;"><p class="big">0</p><p class="kpi">PRIVATE KEYS LEAKED</p></div>
  </div>
</div>`, '07', 'bg-stat.png') });

/* 8 · dx */
slides.push({ name: 'dx', html: frame(`
<p class="eyebrow">Rubric 02 · Design &amp; Craft (DX) — 20%</p>
<h1>A primitive anyone can build on.</h1>
<div class="growrow">
  <div style="width:52%;padding-right:18pt;">
    ${ul([
      '<b style="color:#fff;">@yunzhujia/sdk</b> — typed, buildable, cross-checked against the contracts.',
      'Docs, an in-app /docs page, and a runnable example.'
    ])}
    <p class="mono" style="margin-top:12pt;">Rebuild cost ≈ one week of security work → a few typed calls.</p>
  </div>
  <div class="grow">
    <div class="card" style="margin-bottom:9pt;display:flex;align-items:center;"><img src="${ic('doc')}" style="width:20pt;height:20pt;margin-right:12pt;"><div><p class="num" style="margin-bottom:2pt;">TIER 1 · READ-ONLY</p><p style="font-size:11.5pt;">No wallet, no keys — first result in ~2 minutes.</p></div></div>
    <div class="card" style="margin-bottom:9pt;display:flex;align-items:center;"><img src="${ic('cube')}" style="width:20pt;height:20pt;margin-right:12pt;"><div><p class="num" style="margin-bottom:2pt;">TIER 2 · EOA</p><p style="font-size:11.5pt;">Mint / setPrice / apply with any wallet.</p></div></div>
    <div class="card" style="display:flex;align-items:center;"><img src="${ic('key')}" style="width:20pt;height:20pt;margin-right:12pt;"><div><p class="num" style="margin-bottom:2pt;">TIER 3 · PASSKEY</p><p style="font-size:11.5pt;">Mnemonic-free identity + sponsored gas.</p></div></div>
  </div>
</div>`, '08') });

/* 9 · originality */
slides.push({ name: 'originality', html: frame(`
<p class="eyebrow">Rubric 03 · Originality &amp; Track Insight — 15%</p>
<h1>Privacy-preserving. Not capturable.</h1>
<div class="growrow">
  <div style="width:56%;padding-right:18pt;">
    ${ul([
      '<b style="color:#fff;">Privacy-first:</b> only a commitment hash is stored — content stays off-chain.',
      '<b style="color:#fff;">No vault:</b> payment splits in-transaction, so nothing can be frozen.',
      '<b style="color:#fff;">Lineage on-chain:</b> attribution survives any single app.',
      '<b style="color:#fff;">Permissionless relayer:</b> the signature authorizes, not the operator.',
      '<b style="color:#fff;">Non-custodial:</b> the key lives in the user&rsquo;s secure element.'
    ])}
  </div>
  <div class="grow">
    <div class="card" style="margin-bottom:10pt;border-left:3pt solid ${C.coral};"><p class="num" style="color:${C.coral};">HOW OTHERS &ldquo;FIX&rdquo; IT</p><p>Another vault, another private database.</p></div>
    <div class="card pl"><p class="num">DESIGNER HUB</p><p>On-chain split + lineage + open relay. No single party to capture.</p></div>
  </div>
</div>`, '09') });

/* 10 · market */
slides.push({ name: 'market', html: frame(`
<p class="eyebrow">Rubric 04 · Founder &amp; Market Readiness — 25%</p>
<h1>Who adopts it — and why not build it.</h1>
<div class="row" style="margin-bottom:13pt;">
  <div class="card" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('layers')}"></div><p class="num">01 · DESIGN TOOLS</p><p style="font-size:11.5pt;">Attribution + payouts, no crypto to build.</p></div>
  <div class="card" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('target')}"></div><p class="num">02 · MARKETPLACES</p><p style="font-size:11.5pt;">Passkey login + resale royalty, plug-in.</p></div>
  <div class="card" style="width:24.25%;margin-right:1%;"><div class="chip"><img src="${ic('cpu')}"></div><p class="num">03 · AI PLATFORMS</p><p style="font-size:11.5pt;">A neutral record of which model made what.</p></div>
  <div class="card" style="width:24.25%;"><div class="chip"><img src="${ic('key')}"></div><p class="num">04 · IDENTITY SDKs</p><p style="font-size:11.5pt;">A P-256 account that needs no precompile.</p></div>
</div>
<div class="growrow">
  <div class="card pl" style="width:100%;padding:15pt 18pt;">
    <h2 style="font-size:13.5pt;margin-bottom:5pt;">Why not roll your own?</h2>
    <p style="font-size:12.5pt;">Rebuilding is <b style="color:#fff;">about a week of security-sensitive work:</b> WebAuthn parsing, P-256 math, replay-safe CREATE2 accounts, a challenge scheme and a lineage splitter.</p>
    <p style="font-size:12.5pt;margin-top:5pt;">The SDK reduces it to a few typed calls — and 云筑家 already exports the scheme JSON.</p>
  </div>
</div>`, '10') });

/* 11 · traction + roadmap */
slides.push({ name: 'traction', html: frame(`
<p class="eyebrow">Rubric 05 · Traction &amp; Path Forward — 20%</p>
<h1>Honest status. Concrete plan.</h1>
<div class="row" style="margin-bottom:16pt;">
  <div style="width:30%;padding-right:16pt;">
    <h2 style="font-size:13pt;margin-bottom:7pt;">Where we are</h2>
    ${ul([
      'E2E live on Monad testnet',
      'SDK + docs shipped',
      'No third-party integration <b style="color:${C.accent};">yet</b>'
    ])}
  </div>
  <div class="grow">
    <h2 style="font-size:13pt;margin-bottom:12pt;">Path forward</h2>
    <div style="display:flex;align-items:flex-start;">
      <div style="flex:1;padding-right:7pt;border-top:2pt solid ${C.accent};padding-top:9pt;"><p class="num" style="margin-bottom:5pt;">NOW</p><p style="font-size:11.5pt;">Integration kit shipped</p></div>
      <div style="flex:1;padding:9pt 7pt 0 7pt;border-top:2pt solid ${C.accent2};"><p class="num" style="margin-bottom:5pt;">HACKATHON</p><p style="font-size:11.5pt;">Land one external integration</p></div>
      <div style="flex:1;padding:9pt 7pt 0 7pt;border-top:2pt solid ${C.line2};"><p class="num" style="margin-bottom:5pt;color:${C.mute};">NEXT</p><p style="font-size:11.5pt;">Bounties + &ldquo;built on&rdquo; track</p></div>
      <div style="flex:1;padding:9pt 0 0 7pt;border-top:2pt solid ${C.line2};"><p class="num" style="margin-bottom:5pt;color:${C.mute};">SCALE</p><p style="font-size:11.5pt;">Metered relay · EIP draft</p></div>
    </div>
  </div>
</div>
<div class="growrow">
  <div class="card pl" style="width:100%;padding:15pt 18pt;"><p style="font-size:13.5pt;color:#E4E1F2;">We would rather land one real integration than claim ten.</p></div>
</div>`, '11') });

/* 12 · product */
slides.push({ name: 'product', html: frame(`
<p class="eyebrow">The Product</p>
<h1>Real on-chain data — not mocks.</h1>
<div class="growrow" style="flex-direction:column;justify-content:center;align-items:stretch;">
  <div class="row" style="align-items:flex-start;">
    <div style="width:33.33%;padding-right:7pt;"><div class="shot"><img src="${S('01-home.png')}"></div><p class="mono" style="margin-top:6pt;">GALLERY · LIVE FEED</p></div>
    <div style="width:33.33%;padding:0 7pt;"><div class="shot"><img src="${S('02-scheme-detail.png')}"></div><p class="mono" style="margin-top:6pt;">LINEAGE + VERSIONS</p></div>
    <div style="width:33.33%;padding-left:7pt;"><div class="shot"><img src="${S('06-board.png')}"></div><p class="mono" style="margin-top:6pt;">LEADERBOARD · HEAT</p></div>
  </div>
  <p class="mono" style="margin-top:12pt;">Ledger, remix editor and comments all read live Monad testnet events.</p>
</div>`, '12') });

/* 13 · close + business */
slides.push({ name: 'close', html: frame(`
<p class="eyebrow">Traction · Business</p>
<h1>From testnet to real homes.</h1>
<div class="row" style="margin-bottom:14pt;">
  <div class="card" style="width:49%;margin-right:2%;padding:15pt 16pt;">
    <p class="num">IN DISCUSSION</p>
    <h2 style="font-size:14pt;margin-bottom:4pt;">Commercial partnership</h2>
    <p style="font-size:11.5pt;">In talks with a renovation company (<b style="color:#fff;">刘 binyue</b>) to use Designer Hub schemes in real projects — vetted, traceable designs; the author gets paid on application.</p>
  </div>
  <div class="card pl" style="width:49%;padding:15pt 16pt;">
    <p class="num">WHY IT MATTERS</p>
    <h2 style="font-size:14pt;margin-bottom:4pt;">Real volume, real rail</h2>
    <p style="font-size:11.5pt;">Real projects turn the primitive into traction and revenue — 云筑家 supplies the schemes, the partner brings the demand.</p>
  </div>
</div>
<div class="growrow">
  <div style="width:100%;border-top:1px solid ${C.line2};padding-top:12pt;">
    <p style="font-size:15pt;color:#fff;">The settlement layer for creative work on the AI-native internet.</p>
    <p class="mono" style="margin-top:6pt;">DESIGNER HUB · MONAD TESTNET · TRACK 04 · 榮 / 云筑家 VirtuHome</p>
  </div>
</div>`, '13', 'bg-cover.png') });

/* ---------------- build ---------------- */
async function main() {
  await genAssets();
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Rong · 云筑家 VirtuHome';
  pptx.title = 'Designer Hub · Monad — Pitch';
  const place = {};
  for (let i = 0; i < slides.length; i++) {
    const f = path.join(SLIDES_DIR, `slide-${String(i + 1).padStart(2, '0')}.html`);
    fs.writeFileSync(f, slides[i].html);
    const { slide, placeholders } = await html2pptx(f, pptx);
    if (placeholders && placeholders.length) place[slides[i].name] = { slide, ph: placeholders };
    console.log(`ok ${i + 1}/${slides.length} (${slides[i].name})`);
  }
  // donut chart on 'how'
  if (place.how) {
    place.how.slide.addChart(pptx.charts.DOUGHNUT, [{
      name: 'Split', labels: ['Creator 90%', 'Platform 10%'], values: [90, 10]
    }], {
      ...place.how.ph[0], holeSize: 62, showLegend: true, legendPos: 'b', legendColor: 'C7C3D9',
      legendFontSize: 9, chartColors: ['8B7CFF', '3A3560'], dataLabelColor: 'FFFFFF', dataLabelFontSize: 9
    });
  }
  const out = path.join(ROOT, 'DesignerHub-Pitch.pptx');
  await pptx.writeFile({ fileName: out });
  console.log('WROTE', out);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
