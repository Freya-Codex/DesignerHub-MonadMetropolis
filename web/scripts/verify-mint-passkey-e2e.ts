/**
 * verify-mint-passkey-e2e.ts —— 端到端：用 Passkey（无 MetaMask、免 gas）完成一次「固定 + 铸造」。
 *
 * 覆盖：/passkey 创建 passkey → /mint/create 载入示例 JSON → 固定到 IPFS → passkey 账户自动部署
 * → 用 passkey 签名经 relayer 提交 DreamScheme.mint → 解析出 tokenId。
 *
 * 用法：cd web && npx tsx scripts/verify-mint-passkey-e2e.ts
 * 前置：站点已在 http://localhost:3005 提供服务。复用 OpenClaw Chrome（DH_CDP_PORT，默认 38800）。
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const makeCode = (obj: unknown) => b64url(deflateRawSync(Buffer.from(JSON.stringify(obj))));
const HOME_PLAN = {
  version: 1,
  meta: { id: "code-1", title: "方案码铸造测试·奶油客厅", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  brief: { roomType: "客厅", size: 24, style: "奶油风" },
  moduleA: { styleSummary: "奶油色打底·暖光", keywords: ["奶油", "暖光"], palette: [{ role: "主色", percent: 60, colorName: "奶油白", hex: "#FBF6EC" }, { role: "辅色", percent: 30, colorName: "燕麦", hex: "#E7C8A8" }] },
  moduleB: { rooms: [{ name: "客厅", items: [{ category: "布艺沙发", brand: "宜家" }, { category: "圆茶几" }, { category: "落地灯" }] }] },
  moduleC: {},
  moduleD: {}
};

const CHROME = process.env.DH_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SITE = process.env.DH_SITE || "http://localhost:3005";
const REUSE_PORT = Number(process.env.DH_CDP_PORT || 38800);
const OWN_PORT = Number(process.env.DH_OWN_CDP_PORT || 9335);
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
      if (m.method === "Runtime.consoleAPICalled") {
        const args = (m.params.args || []).map((a: any) => a.value ?? a.description ?? a.type).join(" ");
        c.events.push(`[console.${m.params.type}] ${args}`);
      } else if (m.method === "Runtime.exceptionThrown") {
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

async function browserWsFrom(port: number): Promise<string | null> {
  for (let i = 0; i < 40; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      if (v?.webSocketDebuggerUrl) return v.webSocketDebuggerUrl as string;
    } catch {
      /* not ready */
    }
    await sleep(250);
  }
  return null;
}

async function main() {
  let chrome: ChildProcess | null = null;
  let profile = "";
  let browserWs = await browserWsFrom(REUSE_PORT);
  if (browserWs) console.log(`复用 Chrome :${REUSE_PORT}`);
  else {
    profile = mkdtempSync(join(tmpdir(), "dh-mint-"));
    chrome = spawn(
      CHROME,
      [
        "--headless=new",
        `--remote-debugging-port=${OWN_PORT}`,
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "about:blank"
      ],
      { stdio: "ignore" }
    );
    browserWs = await browserWsFrom(OWN_PORT);
    if (!browserWs) throw new Error("无法连接 Chrome 调试端口");
  }

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
      if (i2 && String(i2.href).includes(path) && i2.btns > 0) return;
      await sleep(250);
    }
    throw new Error(`页面未加载: ${path}`);
  };
  const click = (re: string) =>
    ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>${re}.test(x.textContent||''));if(!b)return 'NOT_FOUND';if(b.disabled)return 'DISABLED';b.click();return 'OK';})()`);
  const clickWhenReady = async (re: string, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      const s = await click(re);
      if (s === "OK") return "OK";
      if (s === "NOT_FOUND") return s;
      await sleep(300);
    }
    return "DISABLED";
  };
  const waitFor = async (exprBool: string, tries = 120) => {
    for (let i = 0; i < tries; i++) {
      if (await ev(exprBool).catch(() => false)) return true;
      await sleep(400);
    }
    return false;
  };

  try {
    await S("Page.enable");
    await S("Runtime.enable");
    await S("WebAuthn.enable");
    await S("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true
      }
    });
    console.log("虚拟认证器已注入");

    // 1) 每次都用当前虚拟认证器新建一个 passkey（避免复用上一轮的陈旧凭证）
    await goto("/passkey");
    await sleep(400);
    await ev(`localStorage.removeItem('dh.passkey.v1')`);
    await goto("/passkey");
    await sleep(600);
    console.log("创建 passkey…");
    if ((await clickWhenReady("/创建 Passkey|重新创建 Passkey/")) !== "OK") throw new Error("创建按钮不可用");
    const ok = await waitFor(`!!localStorage.getItem('dh.passkey.v1')`);
    if (!ok) throw new Error("passkey 创建失败");

    // 2) 铸造页
    await goto("/mint/create");
    await sleep(600);
    const viaCode = process.env.DH_MINT_VIA === "code";
    if (viaCode) {
      console.log("粘贴方案码…");
      for (let i = 0; i < 30; i++) {
        const has = await ev(`[...document.querySelectorAll('button')].some(b=>/解析方案码/.test(b.textContent||''))`);
        if (has) break;
        await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='方案码');if(b)b.click();return 1;})()`);
        await sleep(250);
      }
      await ev(
        `(()=>{const el=document.querySelector('textarea');const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;s.call(el,${JSON.stringify(
          makeCode(HOME_PLAN)
        )});el.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`
      );
      for (let i = 0; i < 30; i++) {
        if ((await click("/解析方案码/")) === "OK") break;
        await sleep(200);
      }
    } else {
      console.log("载入示例 JSON…");
      await clickWhenReady("/载入示例/");
    }
    const schemeOk = await waitFor(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/固定 \\+ 铸造/.test(x.textContent||''));return b&&!b.disabled;})()`);
    if (!schemeOk) throw new Error("示例 JSON 未通过校验（铸造按钮仍禁用）");

    console.log("点击「固定 + 铸造」…");
    if ((await clickWhenReady("/固定 \\+ 铸造/")) !== "OK") throw new Error("铸造按钮不可用");

    const done = await waitFor(
      `(()=>{const t=document.body.innerText;return /铸造成功|铸造失败|请先|失败：/.test(t);})()`,
      160
    );
    const bodyTail = await ev(`document.body.innerText.replace(/\\n{2,}/g,'\\n')`);
    console.log("\n=== 页面全文 ===\n" + String(bodyTail).slice(0, 1800));

    console.log("\n=== console / exceptions ===");
    for (const e of cdp.events.slice(-30)) console.log("  " + e);

    // 读铸造结果
    const success = await ev(`(()=>{const m=document.body.innerText.match(/铸造成功！你的原创方案是\\s*#(\\d+)/);return m?m[1]:null;})()`);
    const err = await ev(`(()=>{const els=[...document.querySelectorAll('div')].map(d=>d.innerText).filter(t=>/铸造失败|失败：|请先/.test(t));return els[0]||null;})()`);

    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});

    if (success) {
      console.log(`\n✅ 铸造成功，原创方案 tokenId = #${success}`);
    } else {
      console.log("\n❌ 未成功：", err || "(未知)", "done=" + done);
      process.exit(1);
    }
  } finally {
    cdp.close();
    if (chrome) chrome.kill("SIGKILL");
    if (profile) {
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

main().catch((e) => {
  console.error("\n❌ E2E 失败:", e?.message || e);
  process.exit(1);
});
