#!/usr/bin/env python3
"""Render the still images of the hero with Playwright:

  assets/og-image.png    1200x630 social preview (hero with the cat awake)
  assets/cat-poster.png  the terminal screen without JavaScript (static fallback)

Usage:  python3 tools/make_og.py
Needs:  pip install playwright pillow && playwright install chromium
?cat=awake pins the cat's state, so the output does not depend on the time of day.
"""
import base64
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from serve import RangeHandler  # noqa: E402

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), RangeHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}/?cat=awake"

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 1200, "height": 760}, device_scale_factor=1, color_scheme="dark")
        page.goto(base)
        page.wait_for_timeout(2500)
        hero = page.locator(".hero").bounding_box()
        page.screenshot(path=str(ROOT / "assets/og-image.png"), clip={"x": 0, "y": hero["y"], "width": 1200, "height": 630})
        data = page.evaluate("document.querySelector('.screen canvas').toDataURL('image/png')")
        (ROOT / "assets/cat-poster.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
        b.close()
    from PIL import Image
    for name in ("og-image.png", "cat-poster.png"):
        path = ROOT / "assets" / name
        Image.open(path).convert("RGB").quantize(colors=256, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
finally:
    server.shutdown()
print("wrote assets/og-image.png and assets/cat-poster.png")
