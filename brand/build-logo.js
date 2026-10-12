const fontkit = require("fontkit");
const fs = require("fs");
const path = require("path");

const col = fontkit.openSync("/System/Library/Fonts/Supplemental/Futura.ttc");
const C = { ink:"#0B1220", ink2:"#16203C", cream:"#EFEADD", amber:"#F2701C", grid:"#6C8CFF" };

function tp(text, fi, size, trackEm, x0, baseY) {
  const f = col.fonts[fi], s = size / f.unitsPerEm, track = (trackEm||0)*size, run = f.layout(text);
  let pen = 0, d = "";
  for (let i=0;i<run.glyphs.length;i++){
    const g=run.glyphs[i], p=run.positions[i];
    const seg=g.path.transform(s,0,0,-s, x0 + (pen+p.xOffset)*s, baseY - p.yOffset*s).toSVG(2);
    if(seg) d+=seg;
    pen+=p.xAdvance; if(i<run.glyphs.length-1) pen+=track/s;
  }
  return { d, width:pen*s, capHeight:f.capHeight*s, descent:-f.descent*s };
}

const HEX = "M408 256 L332 124 L180 124 L104 256 L180 388 L332 388 Z";
const HOUSEBASE = "M162 274 L256 166 L350 274 L326 274 L326 350 L186 350 L186 274 Z";
const DOOR = "M232 294 H280 V350 H232 Z";
const housePath = (door) => `${HOUSEBASE}${door?" "+DOOR:""}`;

function markInner(o){
  o = Object.assign({ tile:true, fg:C.cream, hub:C.amber, grid:true, ring:true, door:true, hex:true, hexW:29, dots:true }, o);
  let s="";
  if(o.tile){
    s+=`<defs><clipPath id="sq"><rect width="512" height="512" rx="112"/></clipPath>
    <linearGradient id="inkg" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#1A2748"/><stop offset="1" stop-color="${C.ink}"/></linearGradient>
    <pattern id="pg" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="${C.grid}" stroke-opacity="0.12" stroke-width="1"/></pattern></defs>
    <rect x="1" y="1" width="510" height="510" rx="111" fill="url(#inkg)"/>`;
    if(o.ring) s+=`<rect x="1" y="1" width="510" height="510" rx="111" fill="none" stroke="${C.cream}" stroke-opacity="0.20" stroke-width="2"/>`;
    if(o.grid) s+=`<g clip-path="url(#sq)"><rect width="512" height="512" fill="url(#pg)"/></g>`;
  }
  if(o.hex) s+=`<path d="${HEX}" fill="none" stroke="${o.fg}" stroke-width="${o.hexW}" stroke-linejoin="round"/>`;
  s+=`<path d="${housePath(o.door)}" fill="${o.fg}" fill-rule="evenodd"/>`;
  if(o.dots) s+=`<circle cx="104" cy="256" r="22" fill="${o.hub}"/><circle cx="408" cy="256" r="22" fill="${o.hub}"/>`;
  return s;
}

function lockup({ fg, hub, tile=false, fontSize=128, track=-0.012, markRatio=1.6, gapRatio=0.4, nudge=0.015 }){
  const m = tp("Designer Hub",0,fontSize,track,0,0);
  const markSize = Math.round(m.capHeight*markRatio);
  const gap = Math.round(m.capHeight*gapRatio);
  const W = Math.round(markSize + gap + m.width), H = markSize;
  const baseline = Math.round(H/2 + m.capHeight/2 - H*nudge);
  const { d } = tp("Designer Hub",0,fontSize,track,markSize+gap,baseline);
  const inner = markInner({ tile, fg, hub });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<g transform="scale(${(markSize/512).toFixed(5)})">${inner}</g>
<path d="${d}" fill="${tile?C.cream:fg}"/></svg>`;
}

function stacked({ fg, hub, tile=false, fontSize=120, track=-0.012 }){
  const m = tp("Designer Hub",0,fontSize,track,0,0);
  const markSize = Math.round(m.width*0.48);
  const gap = Math.round(markSize*0.5);
  const W = Math.max(markSize, Math.round(m.width)), H = markSize + gap + Math.round(m.capHeight + m.descent);
  const mx = Math.round((W-markSize)/2), tx = Math.round((W-m.width)/2);
  const baseline = markSize + gap + Math.round(m.capHeight);
  const { d } = tp("Designer Hub",0,fontSize,track,tx,baseline);
  const inner = markInner({ tile, fg, hub });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<g transform="translate(${mx},0) scale(${(markSize/512).toFixed(5)})">${inner}</g>
<path d="${d}" fill="${tile?C.cream:fg}"/></svg>`;
}

function wordmark({ fg, fontSize=120, track=-0.012 }){
  const m = tp("Designer Hub",0,fontSize,track,0,0);
  const pad = Math.round(fontSize*0.06);
  const W = Math.round(m.width + pad*2), H = Math.round(m.capHeight + m.descent + pad*2);
  const { d } = tp("Designer Hub",0,fontSize,track,pad, pad+Math.round(m.capHeight));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<path d="${d}" fill="${fg}"/></svg>`;
}

const markSquare = (fg,hub,opts={}) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${markInner(Object.assign({tile:true,fg,hub},opts))}</svg>`;
const markCompact = (fg) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${markInner({tile:false,fg,hub:fg,hex:true,door:true,dots:false,grid:false,hexW:26})}</svg>`;

const OUT = process.argv[2]||"out"; const dir=path.resolve(OUT); fs.mkdirSync(dir,{recursive:true});
const W = (n,s)=>fs.writeFileSync(path.join(dir,n),s);

const lkDark = lockup({ fg:C.cream, hub:C.amber });
const lkLight = lockup({ fg:C.ink, hub:C.amber });
W("logo.svg", lkDark);
W("logo-light.svg", lkLight);
W("logo-stacked.svg", stacked({ fg:C.cream, hub:C.amber }));
W("logo-stacked-light.svg", stacked({ fg:C.ink, hub:C.amber }));
W("logo-wordmark.svg", wordmark({ fg:C.cream }));
W("logo-wordmark-light.svg", wordmark({ fg:C.ink }));
W("logo-mark.svg", markSquare(C.cream, C.amber));
W("logo-mark-light.svg", markSquare(C.ink, C.amber, {tile:false}));
W("logo-mark-compact.svg", markCompact(C.cream));
W("logo-mark-compact-light.svg", markCompact(C.ink));
W("logo-mono-dark.svg", lockup({ fg:C.cream, hub:C.cream }));
W("logo-mono-light.svg", lockup({ fg:C.ink, hub:C.ink }));

const bump = s => s.replace(/width="(\d+)" height="(\d+)"/,(_m,w,h)=>`width="${w*2}" height="${h*2}"`);
W("render-dark.html",`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}body{margin:0;background:#080C15;padding:70px}</style></head><body>${bump(lkDark)}</body></html>`);
W("render.html",`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}body{margin:0;font-size:0}
.stage{padding:56px 64px}.d{background:#080C15}.l{background:#F3EFE5}</style></head><body>
<div class="stage d">${bump(lkDark)}</div>
<div class="stage l">${bump(lockup({fg:C.ink,hub:C.amber}))}</div>
</body></html>`);
console.log("ok", lkDark.match(/width="(\d+)" height="(\d+)"/).slice(1).join("x"));
