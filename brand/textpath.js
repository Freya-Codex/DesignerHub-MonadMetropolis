const fontkit = require("fontkit");
const c = fontkit.openSync("/System/Library/Fonts/Supplemental/Futura.ttc");

function build(text, fontIndex, size, trackEm) {
  const font = c.fonts[fontIndex];
  const upm = font.unitsPerEm;
  const s = size / upm;
  const track = (trackEm || 0) * size;

  const run = font.layout(text);
  let penX = 0;
  let d = "";
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i];
    const pos = run.positions[i];
    const X = (penX + pos.xOffset) * s;
    const Y = -pos.yOffset * s;
    const p = g.path.transform(s, 0, 0, -s, X, Y);
    const seg = p.toSVG(2);
    if (seg) d += seg;
    penX += pos.xAdvance;
    if (i < run.glyphs.length - 1) penX += track / s;
  }
  const width = penX * s;
  return {
    d,
    width,
    unitsPerEm: upm,
    capHeight: (font.capHeight ? font.capHeight * s : null),
    xHeight: font.xHeight * s,
    ascent: font.ascent * s,
    descent: font.descent * s,
  };
}

const [text, fi, size, track] = process.argv.slice(2);
const out = build(text, parseInt(fi), parseFloat(size), parseFloat(track || "0"));
console.log(JSON.stringify(out));
