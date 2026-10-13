#!/usr/bin/env python3
import subprocess, os, tempfile, sys
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, "shots-out")
os.makedirs(M, exist_ok=True)
pages = [("demo", 1280, 1500), ("mint", 1280, 1500), ("board", 1280, 1200)]
for p, w, h in pages:
    out = os.path.join(HERE, f"shot-{p}.png")
    try:
        subprocess.run([CHROME, "--headless=new", "--no-first-run", "--force-device-scale-factor=1",
                        "--hide-scrollbars", "--user-data-dir=" + tempfile.mkdtemp(),
                        f"--window-size={w},{h}", "--screenshot=" + out,
                        f"http://127.0.0.1:3017/{p}"], timeout=45, capture_output=True)
    except subprocess.TimeoutExpired:
        pass
    ok = os.path.exists(out)
    if ok:
        subprocess.run(["cp", out, os.path.join(M, f"shot-{p}.png")], capture_output=True)
    print(p, "OK" if ok else "MISSING", (str(os.path.getsize(out)//1024)+"KB") if ok else "")
