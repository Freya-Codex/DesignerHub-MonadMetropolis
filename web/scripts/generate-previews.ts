/**
 * 用蓝图风格重新生成 assets/schemes/previews/*.svg 与 web/public/previews/*.svg
 * 用法（web/ 目录下）：npm run previews
 */
import fs from "node:fs";
import path from "node:path";
import { schemeToPreviewSvg, validateScheme, type DesignScheme } from "../lib/scheme";

const schemesDir = path.join(process.cwd(), "..", "assets", "schemes");
const publicDir = path.join(process.cwd(), "public", "previews");

const files = fs.readdirSync(schemesDir).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) throw new Error(`没有找到示例方案：${schemesDir}`);

fs.mkdirSync(publicDir, { recursive: true });

for (const file of files) {
  const design = JSON.parse(fs.readFileSync(path.join(schemesDir, file), "utf8")) as DesignScheme;
  const err = validateScheme(design);
  if (err) throw new Error(`${file} 校验失败：${err}`);

  const svg = schemeToPreviewSvg(design);
  const name = file.replace(/\.json$/, ".svg");
  const targets = [path.join(schemesDir, "previews", name), path.join(publicDir, name)];
  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, svg, "utf8");
  }
  console.log(`✅ ${name}（${Math.round(svg.length / 1024)} KB）`);
}
console.log("预览图已生成。");
