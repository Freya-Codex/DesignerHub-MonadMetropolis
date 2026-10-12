const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const sharp = require('sharp');

(async () => {
  const dir = path.join(__dirname, 'slides');
  const qa = path.join(__dirname, 'qa');
  fs.mkdirSync(qa, { recursive: true });
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const tiles = [];
  for (const f of files) {
    await page.goto('file://' + path.join(dir, f));
    await page.waitForTimeout(350);
    const png = path.join(qa, f.replace('.html', '.png'));
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 960, height: 540 } });
    tiles.push(png);
  }
  await browser.close();
  // contact sheet
  const cols = 3, tw = 470, th = 264, gap = 12;
  const rows = Math.ceil(tiles.length / cols);
  const W = cols * tw + (cols + 1) * gap;
  const H = rows * th + (rows + 1) * gap;
  const comps = [];
  for (let i = 0; i < tiles.length; i++) {
    const buf = await sharp(tiles[i]).resize(tw, th).png().toBuffer();
    comps.push({ input: buf, left: gap + (i % cols) * (tw + gap), top: gap + Math.floor(i / cols) * (th + gap) });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#d9d9de' } }).composite(comps).png().toFile(path.join(qa, 'sheet.png'));
  console.log('sheet', path.join(qa, 'sheet.png'));
})();
