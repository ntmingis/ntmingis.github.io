#!/usr/bin/env python3
"""Render assets/og-image.png (1200x630 social preview) with Playwright.

Usage:  python3 tools/make_og.py
Needs:  pip install playwright && playwright install chromium
"""
from pathlib import Path
import base64
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

def font(name):
    # Inline as data: URI. Chromium blocks web fonts loaded from file:// (CORS).
    data = base64.b64encode((ROOT / "assets/fonts" / name).read_bytes()).decode()
    return "data:font/woff2;base64," + data


HTML = f"""<!doctype html><meta charset="utf-8"><style>
@font-face {{ font-family: VT323; src: url("{font('vt323-vietnamese.woff2')}"); unicode-range: U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+1EA0-1EF9; }}
@font-face {{ font-family: VT323; src: url("{font('vt323-latin.woff2')}"); }}
html, body {{ margin: 0; }}
body {{ width: 1200px; height: 630px; background: #0b0f0d; color: #d5e3da;
  background-image: radial-gradient(circle at 1px 1px, #1c2822 1px, transparent 0); background-size: 28px 28px;
  font: 28px/1.5 "DejaVu Sans Mono", monospace; display: flex; align-items: center; }}
.wrap {{ margin: 0 80px; border: 2px solid #24332b; border-radius: 12px; background: #070a08; width: 100%; overflow: hidden; }}
.bar {{ background: #111814; padding: 14px 20px; color: #7d978a; font-size: 20px; border-bottom: 2px solid #1f2b24; }}
.bar i {{ display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: #2f3d35; margin-right: 8px; vertical-align: -1px; }}
.body {{ padding: 34px 44px 40px; }}
.ps1 {{ color: #4ade80; }}
h1 {{ font: 96px/1 VT323, monospace; margin: 10px 0 14px; color: #e8f5ec; }}
.role b {{ color: #4ade80; font-weight: 400; }}
.dim {{ color: #7d978a; font-size: 24px; margin-top: 18px; }}
.warn {{ color: #f2b950; }}
</style>
<div class="wrap"><div class="bar"><i></i><i></i><i></i> minh@cyberworld: ~</div><div class="body">
<div><span class="ps1">$</span> whoami</div>
<h1>Nguyễn Tuấn Minh</h1>
<div class="role">Security student → <b>AI Security</b></div>
<div class="dim"><span class="ps1">[verified]</span> detection lab · <span class="warn">[planned]</span> LLM · RAG · agent labs</div>
</div></div>"""

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.set_content(HTML)
    page.evaluate("document.fonts.ready")
    if not page.evaluate("[...document.fonts].every(f => f.status === 'loaded' || f.status === 'unloaded') && [...document.fonts].some(f => f.status === 'loaded')"):
        raise SystemExit("VT323 did not load")
    page.screenshot(path=str(ROOT / "assets/og-image.png"))
    b.close()
print("wrote assets/og-image.png")
