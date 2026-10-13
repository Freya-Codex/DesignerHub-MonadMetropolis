/**
  * verify-scheme-code-e2e.ts -- end-to-end verification of /mint/create's "scheme code (base64url)" import.
 *
  * Covers:
  *   1) this site's DesignScheme code -> decode -> passes validation;
  *   2) VirtuHome HomePlan code -> auto-converted to DesignScheme -> passes validation;
  *   3) an invalid scheme code -> a clear error.
 *
  * Usage: cd web && npx tsx scripts/verify-scheme-code-e2e.ts
  * Prerequisite: the site is serving at http://localhost:3005. Spins up a fresh Chrome by default (avoiding the reused browser's stale DNS).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

const CHROME = process.env.DH_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SITE = process.env.DH_SITE || "http://localhost:3005";
const PORT = Number(process.env.DH_OWN_CDP_PORT || 9347);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const makeCode = (obj: unknown) => b64url(deflateRawSync(Buffer.from(JSON.stringify(obj))));

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
  const profile = mkdtempSync(join(tmpdir(), "dh-code-"));
  let chrome: ChildProcess | null = null;
  let ws: string | null = null;
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      if (v?.webSocketDebuggerUrl) {
        ws = v.webSocketDebuggerUrl as string;
        break;
      }
    } catch {
      /* not ready */
    }
    await sleep(250);
  }
  if (!ws) throw new Error("无法连接 Chrome 调试端口");

  const cdp = await CDP.connect(ws);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m: string, p: Record<string, unknown> = {}) => cdp.send(m, p, sessionId);
  const ev = async (expr: string) => {
    const r = await S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  const click = (re: string) =>
    ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>${re}.test(x.textContent||''));if(!b)return 'NF';if(b.disabled)return 'DIS';b.click();return 'OK';})()`);
  const setTA = (val: string) =>
    ev(
      `(()=>{const el=document.querySelector('textarea');if(!el)return 'NO_TA';const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;s.call(el,${JSON.stringify(
        val
      )});el.dispatchEvent(new Event('input',{bubbles:true}));return 'OK';})()`
    );

  const tests: Array<{ name: string; code: string; expectErr?: boolean; expectName?: string }> = [];

  // 1) this site's DesignScheme code (taken from /api/demo/1)
  const demo = await (await fetch(`${SITE}/api/demo/1`)).json();
  tests.push({ name: "DesignScheme 方案码", code: makeCode(demo), expectName: demo.name });

  // 2) VirtuHome HomePlan code
  const homePlan = {
    version: 1,
    meta: { id: "p1", title: "小户型奶油客厅改造", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    brief: { roomType: "客厅", size: 26, style: "奶油风", budgetLevel: "中" },
    moduleA: {
      styleSummary: "奶油色打底，弧线家具，阳光感",
      keywords: ["奶油", "弧线", "暖光"],
      palette: [
        { role: "主色", percent: 50, colorName: "奶油白", hex: "#FBF6EC" },
        { role: "辅色", percent: 30, colorName: "燕麦", hex: "#E7C8A8" }
      ]
    },
    moduleB: { rooms: [{ name: "客厅", items: [{ category: "布艺沙发", brand: "宜家" }, { category: "圆茶几" }, { category: "落地灯", brand: "飞利浦" }] }] },
    moduleC: {},
    moduleD: {}
  };
  tests.push({ name: "VirtuHome HomePlan 方案码", code: makeCode(homePlan), expectName: "小户型奶油客厅改造" });

  // 3) invalid scheme code
  tests.push({ name: "非法方案码", code: "!!!not-a-valid-code!!!", expectErr: true });

  let pass = 0;
  let fail = 0;
  try {
    await S("Page.enable");
    await S("Runtime.enable");
    await S("Page.navigate", { url: `${SITE}/mint/create` });
    for (let i = 0; i < 80; i++) {
      const n = await ev(`document.querySelectorAll('button').length`).catch(() => 0);
      if (n > 0) break;
      await sleep(250);
    }

    for (const t of tests) {
      // Switch to "scheme code" mode (retrying until React has mounted)
      let switched = false;
      for (let i = 0; i < 30; i++) {
        const has = await ev(`[...document.querySelectorAll('button')].some(b=>/解析方案码/.test(b.textContent||''))`);
        if (has) { switched = true; break; }
        await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='方案码');if(b)b.click();return 'OK';})()`);
        await sleep(250);
      }
      if (!switched) throw new Error("无法切换到「方案码」模式");

      await setTA(t.code);
      await sleep(150);
      let clicked = false;
      for (let i = 0; i < 30; i++) {
        if ((await click("/解析方案码/")) === "OK") { clicked = true; break; }
        await sleep(200);
      }
      if (!clicked) throw new Error("找不到「解析方案码」按钮");

      // Wait for the result
      let outcome: { kind: string; name?: string; err?: string } | null = null;
      for (let i = 0; i < 60; i++) {
        outcome = await ev(`(()=>{
          const t = document.body.innerText;
          const el = document.querySelector('textarea');
          const v = el ? el.value : '';
          let name = null;
          try { const o = JSON.parse(v); if (o && o.name) name = o.name; } catch {}
          const ERR_RE = /(方案码格式无效|解码失败|方案码解出的 JSON 不是有效方案|方案码为空|方案码疑似)[^\\n]{0,80}/;
          const err = (document.body.innerText.match(ERR_RE) || [])[1] || null;
          if (name) return { kind:'ok', name };
          if (err) return { kind:'err', err };
          return null;
        })()`);
        if (outcome) break;
        await sleep(300);
      }

      const ok = t.expectErr ? outcome?.kind === "err" : outcome?.kind === "ok" && (!t.expectName || outcome.name === t.expectName);
      console.log(`${ok ? "✅" : "❌"} ${t.name} → ${JSON.stringify(outcome)}`);
      ok ? pass++ : fail++;

      // Reset to initial (back to JSON mode then back to scheme-code mode) to avoid leftover state: reload the page
      await S("Page.navigate", { url: `${SITE}/mint/create` });
      await sleep(600);
    }

    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
    console.log(`\n=== 方案码导入：${pass} 通过 / ${fail} 失败 ===`);
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
