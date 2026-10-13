const fontkit = require("fontkit");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARCHIVO = path.join(ROOT, "web/public/fonts/archivo-var.woff2");
const OUTPUB = path.join(ROOT, "web/public");
const OUTBRAND = path.join(ROOT, "brand/site");

// Site palette (web/app/globals.css + tailwind.config.ts)
const S = {
  violet: "#6E54FF",       // --violet
  violetDeep: "#4F47EB",   // --violet.deep
  lavender: "#C7D2FE",     // lavender (former brand accent, used as the node color)
  white: "#FFFFFF",
  ink: "#0F0F12",          // --ink
  paper: "#FBFAF9"         // --paper
};

const HEX = "M408 256 L332 124 L180 124 L104 256 L180 388 L332 388 Z";
const HOUSE = "M162 274 L256 166 L350 274 L326 274 L326 350 L186 350 L186 274 Z";
const DOOR = "M232 294 H280 V350 H232 Z";

/** Main mark: hexagon (hub) + solid house (door cut out, showing the background) + two nodes */
function glyph({ fg = S.white, hub = S.lavender, hexW = 30, dots = true, dotR = 22 }) {
  let s = `<path d="${HEX}" fill="none" stroke="${fg}" stroke-width="${hexW}" stroke-linejoin="round"/>`;
  s += `<path d="${HOUSE} ${DOOR}" fill="${fg}" fill-rule="evenodd"/>`;
  if (dots) s += `<circle cx="104" cy="256" r="${dotR}" fill="${hub}"/>` + `<circle cx="408" cy="256" r="${dotR}" fill="${hub}"/>`;
  return s;
}

/** Rounded tile background (site indigo/violet gradient) */
function tile(id = "g", rx = 112) {
  return `<defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${S.violet}"/><stop offset="1" stop-color="${S.violetDeep}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="${rx}" fill="url(#${id})"/>`;
}

const svg = (w, h, vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" role="img">${body}</svg>`;

// ---- Site assets ----
const markTile = (px) => svg(px, px, "0 0 512 512", tile() + glyph({}));
const markPlain = (px) => svg(px, px, "0 0 512 512", glyph({ fg: S.violetDeep, hub: S.violet }));
const favicon = () => svg(64, 64, "0 0 512 512", tile() + glyph({ hexW: 34, dotR: 24 }));

// ---- Wordmark (Archivo, converted to vector paths, no font dependency) ----
const archivo = fontkit.openSync(ARCHIVO);
function wordPath(text, size, x0, baseY) {
  const f = archivo, s = size / f.unitsPerEm, run = f.layout(text);
  let pen = 0, d = "";
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i], p = run.positions[i];
    const seg = g.path.transform(s, 0, 0, -s, x0 + (pen + p.xOffset) * s, baseY - p.yOffset * s).toSVG(2);
    if (seg) d += seg;
    pen += p.xAdvance;
  }
  return { d, width: pen * s, capHeight: f.capHeight * s, descent: -f.descent * s };
}

/** Horizontal lockup: icon (tile) + wordmark */
function lockup({ tone }) {
  const dark = tone === "dark";
  const fg = dark ? S.white : S.ink;
  const m = wordPath("Designer Hub", 128, 0, 0);
  const markSize = Math.round(m.capHeight * 1.6);
  const gap = Math.round(m.capHeight * 0.42);
  const W = Math.round(markSize + gap + m.width), H = markSize;
  const baseline = Math.round(H / 2 + m.capHeight / 2 - H * 0.015);
  const { d } = wordPath("Designer Hub", 128, markSize + gap, baseline);
  const inner = dark
    ? tile("lu") + glyph({})
    : glyph({ fg: S.violetDeep, hub: S.violet });
  return svg(W, H, `0 0 ${W} ${H}`,
    `<g transform="scale(${(markSize / 512).toFixed(5)})">${inner}</g><path d="${d}" fill="${fg}"/>`);
}

const files = {
  "mark.svg": markTile(512),
  "mark-plain.svg": markPlain(512),
  "favicon.svg": favicon(),
  "logo.svg": lockup({ tone: "dark" }),
  "logo-light.svg": lockup({ tone: "light" })
};

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUTPUB, name), content);
  fs.mkdirSync(OUTBRAND, { recursive: true });
  fs.writeFileSync(path.join(OUTBRAND, name), content);
}

// Preview page (light/dark backgrounds)
fs.mkdirSync(OUTBRAND, { recursive: true });
fs.writeFileSync(path.join(OUTBRAND, "preview.html"),
`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{font:13px/1.4 -apple-system,"PingFang SC",sans-serif;color:#cfd3dc;background:#20242c;padding:22px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.c{border:1px solid #3a414d;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:14px}
.dk{background:${S.ink}}.lt{background:${S.paper};color:#3a3a3a}
.t{font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.6}
.hdr{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:8px}
</style></head><body>
<div class="c dk"><div class="t">Header 1x (site indigo/violet)</div>
  <div class="hdr" style="background:#0F0F12;color:#fff">
    <svg width="32" height="32" viewBox="0 0 512 512"><defs><linearGradient id="h1" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="${S.violet}"/><stop offset="1" stop-color="${S.violetDeep}"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#h1)"/>${glyph({ hexW: 30 }) }</svg>
    <span style="font:600 15px/1 -apple-system;letter-spacing:-.02em">Designer Hub<br><span style="font:400 9px/2.2 ui-monospace;letter-spacing:.2em;opacity:.45">DESIGNER HUB · MONAD</span></span>
  </div>
</div>
<div class="c dk"><div class="t">Lockup — dark</div>${files["logo.svg"]}</div>
<div class="c lt"><div class="t">Lockup — light</div>${files["logo-light.svg"]}</div>
<div class="c dk"><div class="t">Mark · favicon 64 / 32 / 16</div>
  <div style="display:flex;align-items:center;gap:16px">
    <img src="mark.svg" width="96"><img src="favicon.svg" width="64"><img src="favicon.svg" width="32"><img src="favicon.svg" width="16"><img src="mark-plain.svg" width="80">
  </div>
</div>
</body></html>`);

console.log("wrote:", Object.keys(files).join(", "));
console.log("lockup size:", files["logo.svg"].match(/width="(\d+)" height="(\d+)"/).slice(1).join("x"));
