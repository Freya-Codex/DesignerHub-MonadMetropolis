/**
 * verify-passkey-e2e.ts —— 端到端：用 Chrome「虚拟认证器」跑通 /passkey 全流程。
 *
 * 覆盖：创建 Passkey → 推导 CREATE2 账户 → relayer 代付部署 → Passkey 签名确权。
 * 通过 CDP WebAuthn 域注入虚拟认证器（自动确认 presence、已校验用户），无需人工点 Touch ID。
 *
 * 用法：
 *   cd web && npm run verify:passkey-e2e
 * 前置：站点已在 http://localhost:3005 提供服务（生产模式需先 `npm run build`）。
 *
 * 连接策略：
 *   1) 若 DH_CDP_PORT（默认 38800，即 OpenClaw 托管的 Chrome）可连，则复用它；
 *   2) 否则自行拉起一个 headless Chrome（--headless=new）。
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.DH_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SITE = process.env.DH_SITE || "http://localhost:3005";
const PAGE_URL = `${SITE}/passkey`;
const REUSE_PORT = Number(process.env.DH_CDP_PORT || 38800);
const OWN_PORT = Number(process.env.DH_OWN_CDP_PORT || 9333);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Pending {
  resolve: (v: any) => void;
  reject: (e: any) => void;
}
class CDP {
  private ws!: WebSocket;
  private idc = 0;
  private pend = new Map<number, Pending>();
  private closed = false;

  static async connect(url: string): Promise<CDP> {
    const c = new CDP();
    c.ws = new WebSocket(url);
    c.ws.addEventListener("message", (e: any) => {
      const m = JSON.parse(e.data as string);
      if (m.id && c.pend.has(m.id)) {
        const p = c.pend.get(m.id)!;
        c.pend.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
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
    if (!this.closed) {
      this.closed = true;
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
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
  if (browserWs) {
    console.log(`复用已有 Chrome 调试端口 :${REUSE_PORT}`);
  } else {
    profile = mkdtempSync(join(tmpdir(), "dh-e2e-"));
    console.log(`自启 headless Chrome :${OWN_PORT}`);
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

  try {
    await S("Page.enable");
    await S("Runtime.enable");
    await S("WebAuthn.enable");
    const { authenticatorId } = await S("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true
      }
    });
    console.log("虚拟认证器:", authenticatorId);

    const ev = async (expr: string) => {
      const r = await S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails)
        throw new Error("eval 异常: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
      return r.result.value;
    };
    const LOG = `(()=>{const b=[...document.querySelectorAll('div')].filter(d=>String(d.className).includes('mono')&&String(d.className).includes('overflow-auto'));return b[0]?b[0].innerText:'';})()`;
    const click = (re: string) =>
      ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>${re}.test(x.textContent||''));if(!b)return 'NOT_FOUND';if(b.disabled)return 'DISABLED';b.click();return 'OK';})()`);
    const clickWhenReady = async (re: string, tries = 40) => {
      for (let i = 0; i < tries; i++) {
        const s = await click(re);
        if (s === "OK") return "OK";
        if (s === "NOT_FOUND") return s;
        await sleep(300); // DISABLED → 等状态更新
      }
      return "DISABLED";
    };
    const waitLog = async (re: RegExp, tries = 100) => {
      let t = "";
      for (let i = 0; i < tries; i++) {
        await sleep(400);
        t = await ev(LOG).catch(() => "");
        if (re.test(t)) break;
      }
      return t;
    };

    await S("Page.navigate", { url: PAGE_URL });
    let info: any = null;
    for (let i = 0; i < 80; i++) {
      info = await ev(`({href:location.href,btns:document.querySelectorAll('button').length})`).catch(() => null);
      if (info && String(info.href).includes("/passkey") && info.btns > 0) break;
      await sleep(250);
    }
    if (!info || !String(info.href).includes("/passkey")) throw new Error("页面未加载到 /passkey");
    await sleep(800);
    await ev(`localStorage.removeItem('dh.passkey.v1')`);

    // Step 1–2: 创建 + 推导
    console.log("点击「创建 Passkey」…");
    if ((await clickWhenReady("/创建 Passkey|重新创建 Passkey/")) !== "OK") throw new Error("未找到创建按钮");
    let logText = await waitLog(/已推导确定性账户地址|创建失败/);
    console.log(logText.trim());
    if (/创建失败|非压缩 P-256/.test(logText)) throw new Error("创建失败");
    const stored = await ev(`localStorage.getItem('dh.passkey.v1')`);
    if (!stored) throw new Error("passkey 未写入 localStorage");
    const cred = JSON.parse(stored);
    console.log("凭证:", cred.credentialIdB64.slice(0, 16) + "…", "\n  x:", cred.x, "\n  y:", cred.y);

    // Step 3: relayer 部署
    console.log("\n点击「relayer 代付部署账户」…");
    if ((await clickWhenReady("/relayer 代付部署账户/")) !== "OK") throw new Error("未找到部署按钮");
    logText = await waitLog(/账户已部署|账户已存在|部署失败/, 120);
    console.log(logText.trim());
    if (/部署失败/.test(logText)) throw new Error("部署失败");

    // Step 4: passkey 签名确权
    console.log("\n点击「用 Passkey 确权」…");
    if ((await clickWhenReady("/用 Passkey 确权/")) !== "OK") throw new Error("未找到确权按钮");
    logText = await waitLog(/确权成功|失败/, 140);
    console.log(logText.trim());
    if (!/确权成功/.test(logText)) throw new Error("确权失败");

    console.log("\n✅ E2E 通过：创建 → 推导 → 部署 → 签名确权 全流程 OK");
  } finally {
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
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
