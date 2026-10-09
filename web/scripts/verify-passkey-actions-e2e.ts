/**
 * verify-passkey-actions-e2e.ts —— 端到端：Passkey（无 MetaMask、免 gas）完成 Remix 铸造 + 创作者定价。
 *
 * 覆盖：
 *   1) /passkey 新建 passkey；
 *   2) /mint/create 用 Passkey 铸造一个原创方案（得到 tokenId A，owner = passkey 账户）；
 *   3) /scheme/A 作为创作者用 Passkey 执行 setPrice（上架定价）；
 *   4) /remix/A 用 Passkey 执行 remix（衍生铸造），解析出 tokenId B。
 *
 * 用法：cd web && DH_CDP_PORT=9999 npx tsx scripts/verify-passkey-actions-e2e.ts
 * 前置：站点已在 http://localhost:3005 提供服务。默认自带全新 Chrome。
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.DH_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SITE = process.env.DH_SITE || "http://localhost:3005";
const PORT = Number(process.env.DH_OWN_CDP_PORT || 9336);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class CDP {
  private ws!: WebSocket;
  private idc = 0;
  private pend = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  events: string[] = [];
  static async connect(url: string): Promise<CDP> {
    const c = new CDP();
    c.ws = new WebSocket(url);
    c.ws.addEventListener("message", (e: any) => {
      const m = JSON.parse(e.data as string);
      if (m.id && c.pend.has(m.id)) {
        const p = c.pend.get(m.id)!;
        c.pend.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
        return;
      }
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params.exceptionDetails;
        c.events.push(`[exception] ${d.exception?.description || d.text}`);
      }
    });
    await new Promise<void>((res, rej) => {
      c.ws.addEventListener("open", () => res());
      c.ws.addEventListener("error", () => rej(new Error("CDP ws 连接失败")));
    });
    return c;
  }
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<any> {
    const id = ++this.idc;
    return new Promise((resolve, reject) => {
      this.pend.set(id, { resolve, reject });
      const msg: Record<string, unknown> = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      this.ws.send(JSON.stringify(msg));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), "dh-pkacts-"));
  let chrome: ChildProcess | null = spawn(
    CHROME,
    ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"],
    { stdio: "ignore" }
  );
  let browserWs: string | null = null;
  for (let i = 0; i < 60; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      if (v?.webSocketDebuggerUrl) {
        browserWs = v.webSocketDebuggerUrl as string;
        break;
      }
    } catch {
      /* not ready */
    }
    await sleep(250);
  }
  if (!browserWs) throw new Error("无法连接 Chrome 调试端口");

  const cdp = await CDP.connect(browserWs);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m: string, p: Record<string, unknown> = {}) => cdp.send(m, p, sessionId);

  const ev = async (expr: string) => {
    const r = await S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  const goto = async (path: string) => {
    await S("Page.navigate", { url: `${SITE}${path}` });
    for (let i = 0; i < 80; i++) {
      const i2 = await ev(`({href:location.href,btns:document.querySelectorAll('button').length})`).catch(() => null);
      if (i2 && String(i2.href).includes(path.split("?")[0]) && i2.btns > 0) return;
      await sleep(250);
    }
    throw new Error(`页面未加载: ${path}`);
  };
  const click = (re: string) =>
    ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>${re}.test(x.textContent||''));if(!b)return 'NOT_FOUND';if(b.disabled)return 'DISABLED';b.click();return 'OK';})()`);
  const clickWhenReady = async (re: string, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      const s = await click(re);
      if (s !== "DISABLED") return s;
      await sleep(300);
    }
    return "DISABLED";
  };
  const waitFor = async (exprBool: string, tries = 150) => {
    for (let i = 0; i < tries; i++) {
      if (await ev(exprBool).catch(() => false)) return true;
      await sleep(400);
    }
    return false;
  };
  const setInput = (selector: string, val: string) =>
    ev(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return 'NF';const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,${JSON.stringify(
        val
      )});el.dispatchEvent(new Event('input',{bubbles:true}));return 'OK';})()`
    );

  let pass = 0;
  let fail = 0;
  const check = (ok: boolean, label: string, extra = "") => {
    console.log(`${ok ? "✅" : "❌"} ${label}${extra ? " → " + extra : ""}`);
    ok ? pass++ : fail++;
  };

  try {
    await S("Page.enable");
    await S("Runtime.enable");
    await S("WebAuthn.enable");
    await S("WebAuthn.addVirtualAuthenticator", {
      options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true }
    });
    console.log("虚拟认证器已注入");

    // 1) 新建 passkey
    await goto("/passkey");
    await sleep(300);
    await ev(`localStorage.removeItem('dh.passkey.v1')`);
    await goto("/passkey");
    await sleep(600);
    if ((await clickWhenReady("/创建 Passkey|重新创建 Passkey/")) !== "OK") throw new Error("创建按钮不可用");
    const hasPk = await waitFor(`!!localStorage.getItem('dh.passkey.v1')`);
    check(hasPk, "创建 Passkey");
    if (!hasPk) throw new Error("passkey 创建失败");

    // 2) 用 Passkey 铸造原创方案
    await goto("/mint/create");
    await sleep(600);
    await clickWhenReady("/载入示例/");
    const schemeOk = await waitFor(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/固定 \\+ 铸造/.test(x.textContent||''));return b&&!b.disabled;})()`);
    check(schemeOk, "示例 JSON 通过校验");
    if ((await clickWhenReady("/固定 \\+ 铸造/")) !== "OK") throw new Error("铸造按钮不可用");
    const minted = await waitFor(`/铸造成功/.test(document.body.innerText)`, 160);
    const tokenA = await ev(`(()=>{const m=document.body.innerText.match(/铸造成功！你的原创方案是\\s*#(\\d+)/);return m?m[1]:null;})()`);
    check(minted && !!tokenA, "Passkey 铸造原创方案", tokenA ? `tokenId #${tokenA}` : "未解析到 tokenId");
    if (!tokenA) throw new Error("未铸出 tokenId");

    // 3) 创作者用 Passkey 定价（setPrice）
    await goto(`/scheme/${tokenA}`);
    const sellerPanel = await waitFor(`/创作者定价|SELLER/.test(document.body.innerText)`, 80);
    check(sellerPanel, "详情页出现「创作者定价」面板（passkey 即创作者）");
    if (sellerPanel) {
      await setInput('input[inputmode="decimal"]', "0.05");
      await sleep(200);
      const clicked = await clickWhenReady("/上架/");
      check(clicked === "OK", "点击「上架」");
      const priced = await waitFor(`/定价交易已提交/.test(document.body.innerText)`, 120);
      const priceNote = await ev(`(()=>{const m=document.body.innerText.match(/定价交易已提交：0x[0-9a-f]+/i);return m?m[0]:null;})()`);
      check(priced, "Passkey setPrice（免 gas）", priceNote || "无回执文本");
    }

    // 4) 用 Passkey 做 Remix 衍生铸造
    await goto(`/remix/${tokenA}`);
    const signerRow = await waitFor(`/SIGNER \\/ 签名/.test(document.body.innerText)`, 80);
    const showsPasskey = await ev(`/Passkey/.test(document.body.innerText)`);
    check(signerRow && showsPasskey, "Remix 页 SIGNER 显示 Passkey");
    const remixBtnOk = await waitFor(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/固定 \\+ 铸造/.test(x.textContent||''));return b&&!b.disabled;})()`);
    check(remixBtnOk, "Remix 铸造按钮可用");
    if ((await clickWhenReady("/固定 \\+ 铸造/")) === "OK") {
      const remixed = await waitFor(`/Remix 铸造成功/.test(document.body.innerText)`, 160);
      const tokenB = await ev(`(()=>{const m=document.body.innerText.match(/衍生方案\\s*#(\\d+)/);return m?m[1]:null;})()`);
      check(remixed && !!tokenB, "Passkey Remix 铸造", tokenB ? `衍生 tokenId #${tokenB}` : "未解析到 tokenId");
    } else {
      check(false, "点击「固定 + 铸造」（Remix）");
    }

    console.log("\n=== exceptions ===");
    for (const e of cdp.events.slice(-15)) console.log("  " + e);
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
    console.log(`\n=== Passkey 动作：${pass} 通过 / ${fail} 失败 ===`);
  } finally {
    cdp.close();
    if (chrome) chrome.kill("SIGKILL");
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("\n❌ E2E 失败:", e?.message || e);
  process.exit(1);
});
