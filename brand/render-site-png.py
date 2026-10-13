#!/usr/bin/env python3
import subprocess, os, tempfile, re
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "web/public")

def read(p): return open(p, encoding="utf-8").read()
def bump(svg, k):
    return re.sub(r'width="(\d+)" height="(\d+)"',
                  lambda m: f'width="{int(m.group(1))*k}" height="{int(m.group(2))*k}"', svg, count=1)

jobs = [
    ("logo.png",       bump(read(os.path.join(PUB, "logo.svg")), 2),       "#0F0F12", "1958x280"),
    ("logo-light.png", bump(read(os.path.join(PUB, "logo-light.svg")), 2), "#FBFAF9", "1958x280"),
    ("mark.png",       bump(read(os.path.join(PUB, "mark.svg")), 1),       "#0F0F12", "632x632"),
]
for name, body, bg, win in jobs:
    doc = f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{{margin:0}}html,body{{background:{bg}}}</style></head><body><div style="padding:40px">{body}</div></body></html>'
    hp = os.path.join(PUB, name.replace(".png", ".render.html"))
    open(hp, "w", encoding="utf-8").write(doc)
    try:
        subprocess.run([CHROME, "--headless=new", "--no-first-run", "--force-device-scale-factor=1",
                        "--hide-scrollbars", "--user-data-dir=" + tempfile.mkdtemp(),
                        "--window-size=" + win, "--screenshot=" + os.path.join(PUB, name),
                        "file://" + hp], timeout=60, capture_output=True)
    except subprocess.TimeoutExpired:
        pass
    os.remove(hp)
    p = os.path.join(PUB, name)
    print(name, (str(os.path.getsize(p)//1024) + "KB") if os.path.exists(p) else "MISSING")
