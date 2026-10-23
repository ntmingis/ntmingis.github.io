#!/usr/bin/env python3
"""Generate pixel-art assets (avatar.svg, favicon.svg, og-image.png).

Run from the repo root:  python3 tools/gen_assets.py
The OG image needs Pillow; the SVGs need only the standard library.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

PALETTE = {
    "K": "#241a3d",  # midnight outline
    "H": "#b9a7f0",  # lavender hair
    "h": "#8c76d9",  # hair shade
    "S": "#ffe2cf",  # skin
    "s": "#efb8a0",  # skin shade / mouth
    "E": "#241a3d",  # eyes
    "P": "#f7a8c8",  # pastel pink
    "C": "#f7a8c8",  # hoodie
    "c": "#e483ad",  # hoodie shade
    "W": "#fffaf0",  # cream
    "L": "#b9a7f0",  # lavender
}

AVATAR = [
    "....KKKKKKKK....",
    "...KHHHHHHHHK...",
    "..KHHHHHHHHHHK..",
    "..KHhHHHHHHhHK..",
    "..KHSSSSSSSSHK..",
    "..KSSSSSSSSSSK..",
    "..KSEESSSSEESK..",
    "..KSEWSSSSEWSK..",
    "..KPSSSssSSSPK..",
    "...KSSSSSSSSK...",
    "....KKSSSSKK....",
    "...KCCCWWCCCK...",
    "..KCCCCLLCCCCK..",
    "..KCcCCLLCCcCK..",
    "..KCcCCCCCCcCK..",
    "..KKKKKKKKKKKK..",
]

SHIELD = [
    "................",
    "...KKKKKKKKKK...",
    "..KLLLLLLLLLLK..",
    "..KLLLLLLLLLLK..",
    "..KLLPPLLPPLLK..",
    "..KLPPPPPPPPLK..",
    "..KLPPPPPPPPLK..",
    "..KLLPPPPPPLLK..",
    "..KLLLPPPPLLLK..",
    "...KLLLPPLLLK...",
    "...KLLLLLLLLK...",
    "....KLLLLLLK....",
    ".....KLLLLK.....",
    "......KLLK......",
    ".......KK.......",
    "................",
]


def to_svg(grid, title):
    assert all(len(r) == 16 for r in grid), "grid rows must be 16 wide"
    rects = []
    for y, row in enumerate(grid):
        x = 0
        while x < 16:
            ch = row[x]
            if ch == ".":
                x += 1
                continue
            run = 1
            while x + run < 16 and row[x + run] == ch:
                run += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{PALETTE[ch]}"/>')
            x += run
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" '
        f'shape-rendering="crispEdges" role="img" aria-label="{title}">'
        f"<title>{title}</title>" + "".join(rects) + "</svg>\n"
    )


def og_image():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("Pillow not installed: skipping og-image.png")
        return
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#17112b")
    d = ImageDraw.Draw(img)
    # pixel grid backdrop
    for gx in range(0, W, 30):
        for gy in range(0, H, 30):
            if (gx // 30 + gy // 30) % 7 == 0:
                d.rectangle([gx, gy, gx + 5, gy + 5], fill="#2c2350")
    # avatar panel
    d.rectangle([80, 135, 440, 495], fill="#fffaf0", outline="#f7a8c8", width=8)
    s = 20
    for y, row in enumerate(AVATAR):
        for x, ch in enumerate(row):
            if ch != ".":
                d.rectangle([100 + x * s, 155 + y * s, 100 + x * s + s - 1, 155 + y * s + s - 1], fill=PALETTE[ch])

    def font(size, bold=True):
        name = "DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf"
        try:
            return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size)
        except OSError:
            return ImageFont.load_default()

    d.text((500, 170), "PLAYER PROFILE", font=font(28), fill="#f7a8c8")
    d.text((500, 215), "Cybersecurity", font=font(64), fill="#fffaf0")
    d.text((500, 290), "Learner", font=font(64), fill="#fffaf0")
    d.text((500, 385), "Detection Engineering", font=font(32, False), fill="#c6b5ff")
    d.text((500, 430), "Exploring AI Engineering", font=font(32, False), fill="#c6b5ff")
    d.rectangle([0, H - 16, W, H], fill="#f7a8c8")
    img.save(ASSETS / "og-image.png", optimize=True)


if __name__ == "__main__":
    ASSETS.mkdir(exist_ok=True)
    (ASSETS / "avatar.svg").write_text(to_svg(AVATAR, "Pixel-art avatar"))
    (ASSETS / "favicon.svg").write_text(to_svg(SHIELD, "Pixel shield"))
    og_image()
    print("assets written to", ASSETS)
