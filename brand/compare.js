const fs=require("fs");
const S={violet:"#6E54FF",violetDeep:"#4F47EB",lavender:"#C7D2FE",white:"#FFFFFF",ink:"#0F0F12",paper:"#FBFAF9"};
const HEX="M408 256 L332 124 L180 124 L104 256 L180 388 L332 388 Z";
const HOUSE="M162 274 L256 166 L350 274 L326 274 L326 350 L186 350 L186 274 Z";
const DOOR="M232 294 H280 V350 H232 Z";
function glyph({fg=S.white,hub,dots=true,hexW=30,dotR=24}){
  let s=`<path d="${HEX}" fill="none" stroke="${fg}" stroke-width="${hexW}" stroke-linejoin="round"/>`;
  s+=`<path d="${HOUSE} ${DOOR}" fill="${fg}" fill-rule="evenodd"/>`;
  if(dots&&hub) s+=`<circle cx="104" cy="256" r="${dotR}" fill="${hub}"/><circle cx="408" cy="256" r="${dotR}" fill="${hub}"/>`;
  return s;
}
const grad=(id,a,b)=>`<defs><linearGradient id="${id}" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
function tile(id){return grad(id,S.violet,S.violetDeep)+`<rect width="512" height="512" rx="112" fill="url(#${id})"/>`;}
const W=(h,bg)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${h}" height="${h}" viewBox="0 0 512 512">${bg}${glyph(arguments[2]||{})}</svg>`;
const A=W(0,tile("a"),{hub:S.lavender});
const B=W(0,tile("b"),{hub:s=>s});
const C=W(0,tile("c"),{dots:false});
const D=tile("d")+""; // placeholder
const E=W(0,grad("e",S.paper,S.paper)+`<rect width="512" height="512" rx="112" fill="url(#e)"/>`,{fg:S.violetDeep,hub:S.violet});
const F=W(0,tile("f"),{hub:S.white,dotR:26});
function cell(t,svg,f){return `<div class="c"><div class="t">${t}</div><div class="r">${svg.replace('width="0" height="0"','width="96" height="96"')}${svg.replace('width="0" height="0"','width="32" height="32"')}${svg.replace('width="0" height="0"','width="16" height="16"')}</div></div>`;}
const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}body{background:#0F0F12;color:#cfd3dc;font:12px -apple-system,"PingFang SC";padding:20px;display:flex;flex-wrap:wrap;gap:14px}
.c{border:1px solid #2b2b33;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px}
.t{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.55}.r{display:flex;align-items:center;gap:14px}
</style></head><body>
${cell("A violet + lavender nodes",A)}
${cell("B violet + no nodes",C)}
${cell("C paper tile + violet glyph",E)}
${cell("D violet + white nodes(r26)",F)}
</body></html>`;
fs.writeFileSync("cmp.html",html);
