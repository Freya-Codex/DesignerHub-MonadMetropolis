#!/usr/bin/env python3
import subprocess, os, tempfile, glob

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
FINAL = os.path.join(HERE, "final")
os.makedirs(FINAL, exist_ok=True)

def read(f): return open(os.path.join(OUT, f), encoding="utf-8").read()
def scale(svg, k=2):
    import re
    return re.sub(r'width="(\d+)" height="(\d+)"',
                  lambda m: f'width="{int(m.group(1))*k}" height="{int(m.group(2))*k}"', svg, count=1)

lockup = scale(read("logo.svg"))
mark = scale(read("logo-mark.svg"))
stacked = scale(read("logo-stacked.svg"))

def html(body, bg):
    return f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{{margin:0}}html,body{{margin:0;background:{bg}}}</style></head><body>{body}</body></html>'

jobs = [
    ("designer-hub-logo.png",                html(f'<div style="padding:60px">{lockup}</div>', "#080C15"), None, "2024x384", "60px"),
    ("designer-hub-logo-transparent.png",    html(f'<div style="padding:60px">{lockup}</div>', "transparent"), "00000000", "2024x384", "60px"),
    ("designer-hub-mark.png",                html(f'<div style="padding:60px">{mark}</div>', "#080C15"), None, "1146x1146", "60px"),
    ("designer-hub-logo-light.png",          html(f'<div style="padding:60px">{scale(read("logo-light.svg"))}</div>', "#F3EFE5"), None, "2024x384", "60px"),
]

for name, doc, transparent, win, _pad in jobs:
    hp = os.path.join(FINAL, name.replace(".png", ".html"))
    open(hp, "w", encoding="utf-8").write(doc)
    args = [CHROME, "--headless=new", "--no-first-run", "--force-device-scale-factor=1",
            "--hide-scrollbars", "--user-data-dir=" + tempfile.mkdtemp(),
            "--window-size=" + win, "--screenshot=" + os.path.join(FINAL, name), "file://" + hp]
    if transparent:
        args.insert(3, "--default-background-color=" + transparent)
    try:
        subprocess.run(args, timeout=75, capture_output=True)
    except subprocess.TimeoutExpired:
        pass
    p = os.path.join(FINAL, name)
    print(name, "->", (str(os.path.getsize(p)//1024) + "KB") if os.path.exists(p) else "MISSING")
