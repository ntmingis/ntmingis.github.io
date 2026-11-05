#!/usr/bin/env python3
"""Render the still images of the hero scene with Playwright:

  assets/og-image.png      1200x630 social preview (hero with text, sword drawn)
  assets/knight-poster.jpg static fallback behind the canvas (no JS / canvas failure)

Usage:  python3 tools/make_og.py
Needs:  pip install playwright pillow && playwright install chromium
The scene is frozen with ?scene=<seconds>, so the output is deterministic.
"""
import base64
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from serve import RangeHandler  # noqa: E402  (Range support: the hero video must be seekable)

# With a hero film the poster comes from tools/prepare_video.py, not from the canvas.
VIDEO_MODE = "export default null;" not in (ROOT / "js/scene/video-manifest.js").read_text(encoding="utf-8")
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), RangeHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}/"

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # social preview: hero exactly 1200x630 below the 57px top bar
        page = b.new_page(viewport={"width": 1200, "height": 687}, device_scale_factor=1, color_scheme="dark")
        page.goto(base + "?scene=7.3")
        page.wait_for_timeout(1500 if VIDEO_MODE else 400)
        page.locator(".hero").screenshot(path=str(ROOT / "assets/og-image.png"))
        # poster: the resting knight, canvas only (the text is real HTML on top)
        if VIDEO_MODE:
            b.close()
            raise SystemExit("video mode: og-image.png written; the poster comes from tools/prepare_video.py")
        page = b.new_page(viewport={"width": 1600, "height": 957}, device_scale_factor=1, color_scheme="dark")
        page.goto(base + "?scene=24.5")
        page.wait_for_timeout(400)
        # read the canvas pixels directly (an element screenshot would include the HTML text on top)
        data = page.evaluate("document.querySelector('.hero-scene canvas').toDataURL('image/jpeg', 0.78)")
        (ROOT / "assets/knight-poster.jpg").write_bytes(base64.b64decode(data.split(",", 1)[1]))
        b.close()
    # 256-colour palette keeps the preview small (dark scene, few distinct colours)
    from PIL import Image
    og = ROOT / "assets/og-image.png"
    Image.open(og).convert("RGB").quantize(colors=256, dither=Image.Dither.FLOYDSTEINBERG).save(og, optimize=True)
finally:
    server.shutdown()
print("wrote assets/og-image.png and assets/knight-poster.jpg")
