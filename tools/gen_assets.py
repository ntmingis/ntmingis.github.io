#!/usr/bin/env python3
"""Generate the pixel-art assets for BLACK CAT // CYBER WORLD.

Run from the repo root:  python3 tools/gen_assets.py
Needs Pillow (scene layers and og-image.png are PNG); icons are plain SVG.

Outputs
  assets/scene/*.png   192x108 layers of the intro scene. Every layer has the
                       full scene size, so the page simply stacks them.
  assets/icons/*.svg   16x16 HUD menu icons
  assets/favicon.svg   black-cat favicon
  assets/og-image.png  social preview (1200x630)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
W, H = 192, 108


def rgba(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


class Layer:
    def __init__(self):
        self.img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            self.px[x, y] = rgba(c)

    def clear(self, x, y):
        self.px[x, y] = (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def fill(self, pts, c):
        for x, y in pts:
            self.set(x, y, c)

    def save(self, name):
        self.img.save(ASSETS / "scene" / f"{name}.png", optimize=True)


# ---------- shape helpers: each returns a set of (x, y) pixels ----------
def ellipse(cx, cy, rx, ry):
    return {(x, y)
            for y in range(math.floor(cy - ry), math.ceil(cy + ry) + 1)
            for x in range(math.floor(cx - rx), math.ceil(cx + rx) + 1)
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0}


def tri(a, b, c):
    out = set()
    xs, ys = [p[0] for p in (a, b, c)], [p[1] for p in (a, b, c)]

    def side(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    for y in range(min(ys), max(ys) + 1):
        for x in range(min(xs), max(xs) + 1):
            d1, d2, d3 = side((x, y), a, b), side((x, y), b, c), side((x, y), c, a)
            if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)):
                out.add((x, y))
    return out


def stroke(points, width=1):
    """Thick polyline: a disc of `width` stamped along each segment."""
    out, r = set(), (width - 1) / 2
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            if r <= 0:
                out.add((x, y))
            else:
                out |= ellipse(x, y, r + .5, r + .5)
    return out


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dithered(x, y, colors, t):
    """Ordered-dither between a list of colors, t in [0, 1]."""
    t = max(0.0, min(1.0, t)) * (len(colors) - 1)
    i = min(int(t), len(colors) - 2)
    return colors[i + 1] if BAYER[y % 4][x % 4] / 16 < t - i else colors[i]


# ---------- palette ----------
WALL, WALL_LINE = "#1b1433", "#1f1739"
FRAME, FRAME_HI, FRAME_LO = "#2e2454", "#43357a", "#221a40"
SKY = ["#100c2a", "#161137", "#1d1545", "#271a52", "#33205d", "#442766", "#57306e"]
MOON, MOON_DARK, MOON_GLOW = "#efe7ff", "#cdbff0", "#2a2263"
CITY_FAR, CITY_NEAR = "#2c2050", "#18122f"
LIGHTS = ["#f7a8c8", "#7ff5d2", "#c9bbf5", "#ffd98a"]
DESK, DESK_BACK, DESK_GRAIN, DESK_EDGE, DESK_EDGE_HI = "#3b2c60", "#2e2350", "#43336c", "#5a4790", "#6c58a8"
DESK_FRONT, DESK_SHADOW = "#241a40", "#191230"
BEIGE, BEIGE_HI, BEIGE_LO, BEIGE_DK = "#cfc4e8", "#e6def7", "#a99cc9", "#8576ad"
BEZEL, GLASS = "#2b2150", "#08160f"
FUR, FUR_FAR = "#0b0814", "#17112a"
RIM, RIM_TOP = "#24715e", "#3a3174"
EYE, PUPIL, SHINE = "#7ff5d2", "#06040b", "#ffffff"
EAR_IN, NOSE, WHISKER = "#5a3363", "#f7a8c8", "#4f4588"
PINK, PINK_LO = "#f7a8c8", "#d987ab"
LEAF, LEAF_HI = "#2f7a63", "#45a585"
FG = "#07050d"


# ---------- background: wall, window, night city, shelf ----------
def background():
    L = Layer()
    L.rect(0, 0, W - 1, H - 1, WALL)
    for x in range(5, W, 12):
        L.rect(x, 0, x, 69, WALL_LINE)
    # floor / baseboard (mostly hidden behind the desk)
    L.rect(0, 78, W - 1, 79, "#2a2148")
    L.rect(0, 80, W - 1, H - 1, "#120d22")

    # window
    x0, y0, x1, y1 = 22, 6, 86, 56
    L.rect(x0, y0, x1, y1, FRAME)
    gx0, gy0, gx1, gy1 = x0 + 3, y0 + 3, x1 - 3, y1 - 3
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            L.set(x, y, dithered(x, y, SKY, (y - gy0) / (gy1 - gy0)))
    # moon + glow
    for x, y in ellipse(70, 19, 9.5, 9.5):
        if BAYER[y % 4][x % 4] < 7:
            L.set(x, y, MOON_GLOW)
    L.fill(ellipse(70, 19, 6, 6), MOON)
    L.fill({(67, 17), (68, 17), (68, 18), (72, 21), (73, 21), (71, 15), (69, 22)}, MOON_DARK)
    # static stars (the twinkling ones are drawn by CSS)
    for x, y in [(28, 11), (35, 16), (41, 10), (47, 21), (55, 13), (61, 25), (31, 26), (80, 30), (52, 29), (79, 12)]:
        L.set(x, y, "#c9bbf5")
    # skyline: far then near buildings, with lit windows
    rnd = random.Random(7)
    x = gx0
    while x <= gx1:
        w = rnd.randint(4, 7)
        top = rnd.randint(30, 40)
        L.rect(x, top, min(x + w - 1, gx1), gy1, CITY_FAR)
        x += w + rnd.randint(0, 1)
    x = gx0
    while x <= gx1:
        w = rnd.randint(5, 9)
        top = rnd.randint(38, 46)
        L.rect(x, top, min(x + w - 1, gx1), gy1, CITY_NEAR)
        if rnd.random() < .5 and x + w // 2 <= gx1:  # antenna
            L.rect(x + w // 2, top - 3, x + w // 2, top - 1, CITY_NEAR)
            L.set(x + w // 2, top - 4, "#f7a8c8")
        for wy in range(top + 2, gy1 - 1, 3):
            for wx in range(x + 1, min(x + w - 1, gx1), 2):
                if rnd.random() < .28:
                    L.set(wx, wy, rnd.choice(LIGHTS))
        x += w + 1
    # mullions + frame shading
    L.rect(54, gy0, 55, gy1, FRAME)
    L.rect(gx0, 30, gx1, 31, FRAME)
    L.rect(x0, y0, x1, y0, FRAME_HI)
    L.rect(x0, y0, x0, y1, FRAME_HI)
    L.rect(x1, y0, x1, y1, FRAME_LO)
    # sill
    L.rect(x0 - 3, y1 + 1, x1 + 3, y1 + 3, "#3a2d66")
    L.rect(x0 - 3, y1 + 1, x1 + 3, y1 + 1, "#4c3c86")
    L.rect(x0 - 3, y1 + 4, x1 + 3, y1 + 4, "#140f26")

    # small poster on the left wall: a pixel shield
    L.rect(4, 14, 16, 30, "#2b2150")
    L.rect(5, 15, 15, 29, "#211939")
    L.fill(tri((7, 21), (13, 21), (10, 27)) | {(x, y) for x in range(7, 14) for y in range(18, 22)}, "#5536b8")
    L.fill({(10, 20), (10, 21), (9, 21), (11, 21), (10, 22)}, "#f7a8c8")

    # shelf with books on the right wall
    L.rect(150, 24, 184, 25, "#3a2d66")
    L.rect(150, 26, 184, 26, "#140f26")
    bx = 152
    for w, h, c in [(2, 9, "#6b4fa8"), (3, 10, "#f7a8c8"), (2, 8, "#3f8f78"), (3, 9, "#c9bbf5"),
                    (2, 7, "#8e5fb0"), (1, 1, None), (3, 6, "#5536b8")]:
        if c:
            L.rect(bx, 24 - h, bx + w - 1, 23, c)
            L.rect(bx, 24 - h + 2, bx + w - 1, 24 - h + 2, "#241a3d")
        bx += w
    # a tiny glowing cube on the shelf
    L.rect(176, 19, 181, 23, "#1f4a3d")
    L.rect(177, 20, 180, 22, "#7ff5d2")
    # neon heart under the shelf
    heart = ["..XX.XX..", ".X..X..X.", ".X.....X.", "..X...X..", "...X.X...", "....X...."]
    for j, row in enumerate(heart):
        for i, ch in enumerate(row):
            if ch == "X":
                L.set(162 + i, 34 + j, "#ff7ab8")
    return L


# ---------- desk, CRT monitor, keyboard, props ----------
def desk():
    L = Layer()
    # desk top face, edge and front panel
    L.rect(12, 70, 184, 79, DESK)
    L.rect(12, 70, 184, 70, DESK_BACK)
    rnd = random.Random(3)
    for _ in range(16):
        x, y = rnd.randint(14, 178), rnd.randint(72, 78)
        L.rect(x, y, x + rnd.randint(3, 8), y, DESK_GRAIN)
    L.rect(10, 80, 186, 81, DESK_EDGE)
    L.rect(10, 80, 186, 80, DESK_EDGE_HI)
    L.rect(14, 82, 182, H - 1, DESK_FRONT)
    L.rect(14, 82, 182, 83, DESK_SHADOW)
    L.rect(132, 88, 176, 101, "#2b2049")
    L.rect(133, 89, 175, 100, DESK_FRONT)
    L.rect(150, 93, 158, 94, DESK_EDGE)

    # monitor stand + base
    L.rect(110, 66, 132, 71, BEIGE_LO)
    L.rect(104, 71, 138, 73, BEIGE)
    L.rect(104, 71, 138, 71, BEIGE_HI)
    L.rect(104, 74, 138, 74, "#2a2048")
    # CRT body (rounded corners) with light from the top-left
    bx0, by0, bx1, by1 = 94, 24, 148, 67
    L.rect(bx0, by0, bx1, by1, BEIGE)
    L.rect(bx0, by0, bx1, by0, BEIGE_HI)
    L.rect(bx0, by0, bx0, by1, BEIGE_HI)
    L.rect(bx1, by0, bx1, by1, BEIGE_LO)
    L.rect(bx0, by1, bx1, by1, BEIGE_LO)
    for x, y in [(bx0, by0), (bx1, by0), (bx0, by1), (bx1, by1)]:
        L.clear(x, y)
    # bezel + glass (the HTML terminal sits on top of the glass)
    L.rect(98, 28, 144, 63, BEZEL)
    L.rect(98, 63, 144, 63, BEIGE_LO)
    L.rect(101, 30, 141, 61, GLASS)
    # front strip: vents + power LED
    for x in range(100, 118, 2):
        L.set(x, 65, BEIGE_DK)
    L.rect(139, 65, 140, 65, "#7ff5d2")
    # sticky note
    L.rect(143, 25, 147, 29, PINK)
    L.rect(144, 27, 146, 27, PINK_LO)

    # keyboard (in front of the monitor) + mouse
    L.rect(84, 74, 122, 78, BEIGE)
    L.rect(84, 78, 122, 78, BEIGE_DK)
    for y in (74, 76):
        for x in range(85, 122, 2):
            L.set(x, y, BEIGE_HI)
    L.rect(95, 77, 111, 77, BEIGE_HI)  # space bar
    L.rect(128, 75, 132, 77, BEIGE)
    L.rect(128, 75, 132, 75, BEIGE_HI)
    L.fill(stroke([(130, 74), (131, 71), (128, 70)]), BEIGE_DK)

    # book stack (left)
    for (x0, y0, x1, y1, c) in [(16, 66, 34, 69, "#6b4fa8"), (18, 62, 32, 65, "#3f8f78"), (17, 58, 31, 61, PINK)]:
        L.rect(x0, y0, x1, y1, c)
        L.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, "#efe7ff")
        L.rect(x0, y1, x1, y1, "#241a3d")

    # mug
    L.rect(152, 63, 158, 70, PINK)
    L.rect(157, 63, 158, 70, PINK_LO)
    L.rect(152, 63, 158, 63, "#3a2448")
    L.rect(159, 65, 160, 65, PINK)
    L.rect(160, 66, 160, 67, PINK)
    L.rect(159, 68, 160, 68, PINK)
    L.rect(154, 66, 156, 67, "#efe7ff")

    # plant
    L.rect(166, 62, 177, 70, "#6b4fa8")
    L.rect(165, 61, 178, 62, "#8e5fb0")
    for pts in ([(171, 61), (168, 52), (164, 47)], [(172, 61), (174, 50), (178, 44)],
                [(171, 61), (171, 48), (170, 41)], [(172, 61), (179, 54), (183, 52)]):
        L.fill(stroke(pts, 2), LEAF)
    L.fill({(164, 47), (178, 44), (170, 41), (183, 52), (168, 51), (175, 49)}, LEAF_HI)
    return L


# ---------- the black cat ----------
BODY = (ellipse(62, 68, 12, 10.5) | ellipse(72, 60, 9, 13) |
        {(x, y) for x in range(52, 79) for y in range(75, 79)})
BODY = {(x, y) for x, y in BODY if y <= 78}
HEAD = ellipse(80, 46, 8, 7) | ellipse(87, 49, 3.2, 2.6) | ellipse(80, 51, 6, 3)
EAR_BACK = tri((74, 41), (76, 34), (80, 39))
EAR_FRONT_UP = tri((79, 40), (83, 33), (86, 41))
EAR_FRONT_FLICK = tri((79, 40), (85, 35), (87, 42))
TAILS = {
    "a": [(53, 77), (45, 77), (40, 75), (37, 71), (37, 66), (39, 63)],
    "b": [(53, 77), (45, 77), (40, 76), (36, 73), (34, 68), (35, 64)],
    "c": [(53, 77), (45, 78), (39, 77), (35, 75), (32, 71), (32, 67)],
}
REST_NEAR, REST_FAR = [(79, 63), (84, 70), (90, 75)], [(76, 64), (80, 71), (85, 75)]
UP_NEAR, UP_FAR = [(79, 63), (84, 67), (90, 72)], [(76, 64), (80, 68), (85, 72)]


def leg(path):
    tip = path[-1]
    return stroke(path, 3) | ellipse(tip[0] + 1, tip[1], 2.2, 1.4)


SILHOUETTE = BODY | HEAD | EAR_BACK | EAR_FRONT_UP | stroke(TAILS["a"], 3) | leg(REST_NEAR) | leg(REST_FAR)


def fur(L, pts, base=FUR, everything=SILHOUETTE, crt=True):
    """Fur with a faint teal rim where the CRT lights the cat (front, right edges)
    and moonlight from the window on the top and back edges."""
    for x, y in pts:
        c = base
        if crt and x >= 76 and y < 70 and (x + 1, y) not in everything:
            c = RIM
        elif (x, y - 1) not in everything or ((x - 1, y) not in everything and y < 76):
            c = RIM_TOP
        L.set(x, y, c)


def cat_layers():
    body = Layer()
    fur(body, BODY)
    body.save("cat-body")

    head = Layer()
    fur(head, HEAD | EAR_BACK)
    head.fill({(76, 37), (76, 38), (77, 38)}, EAR_IN)
    head.fill({(83, 44), (84, 44), (85, 44), (83, 45), (85, 45)}, EYE)
    head.set(84, 45, PUPIL)
    head.set(83, 44, SHINE)
    head.set(90, 48, NOSE)
    head.fill(stroke([(90, 50), (95, 49)]), WHISKER)
    head.fill(stroke([(90, 51), (95, 52)]), WHISKER)
    head.save("cat-head")

    for name, ear in (("cat-ear-a", EAR_FRONT_UP), ("cat-ear-b", EAR_FRONT_FLICK)):
        L = Layer()
        fur(L, ear, everything=SILHOUETTE | ear)
        inner = {(82, 37), (82, 38), (83, 38), (83, 39)} if name.endswith("a") else {(84, 38), (84, 39), (83, 39)}
        L.fill(inner, EAR_IN)
        L.save(name)

    blink = Layer()
    blink.fill({(83, 44), (84, 44), (85, 44), (83, 45), (84, 45), (85, 45)}, FUR)
    blink.fill({(83, 45), (84, 45), (85, 45)}, "#3f9f86")
    blink.save("cat-blink")

    for key, path in TAILS.items():
        L = Layer()
        pts = stroke(path, 3)
        fur(L, pts, everything=SILHOUETTE | pts, crt=False)
        L.save(f"cat-tail-{key}")

    for name, near, far in (("rest", REST_NEAR, REST_FAR), ("a", UP_NEAR, REST_FAR), ("b", REST_NEAR, UP_FAR)):
        L = Layer()
        n, f = leg(near), leg(far)
        L.fill(f, FUR_FAR)
        fur(L, n, everything=SILHOUETTE | n | f)
        L.save(f"cat-paws-{name}")


# ---------- foreground silhouettes (blurred by CSS for depth) ----------
def foreground():
    L = Layer()
    for pts in ([(0, 107), (6, 92), (14, 84)], [(2, 107), (10, 96), (22, 92)], [(0, 100), (4, 88), (3, 78)],
                [(191, 107), (185, 95), (178, 90)], [(191, 100), (188, 88), (190, 80)]):
        L.fill(stroke(pts, 4), FG)
    L.fill(ellipse(14, 84, 4, 2.5) | ellipse(22, 92, 4, 2) | ellipse(3, 78, 2, 4) |
           ellipse(178, 90, 4, 2.5) | ellipse(190, 80, 2, 4), FG)
    return L


# ---------- 16x16 SVG sprites (favicon, HUD icons) ----------
PALETTE = {
    "K": "#241a3d", "W": "#fffaf0", "L": "#b9a7f0", "P": "#f7a8c8", "G": "#5fd6a8",
    "g": "#b8f7e2", "B": "#8e5fb0", "Y": "#ffd98a", "F": "#0b0814", "O": "#b9a7f0",
}

CAT_FACE = [
    "................",
    ".FF.........FF..",
    ".FPF.......FPF..",
    ".FPPF.....FPPF..",
    ".FFFFFFFFFFFFF..",
    ".FFFFFFFFFFFFF..",
    ".FFFFFFFFFFFFF..",
    ".FFGGFFFFFGGFF..",
    ".FFGFFFFFFGFFF..",
    ".FFFFFFPFFFFFF..",
    "..FFFFFFFFFFF...",
    "...FFFFFFFFF....",
    "....FFFFFFF.....",
    "................",
    "................",
    "................",
]

ICONS = {
    "projects": [
        "................", "............KKK.", "...........KWWK.", "..........KWWLK.",
        ".........KWWLK..", "........KWWLK...", ".......KWWLK....", "..KK..KWWLK.....",
        "..KPKKWWLK......", "...KPPWLK.......", "....KPPK........", "...KGKKPK.......",
        "..KGK..KPK......", ".KGK....KK......", ".KK.............", "................",
    ],
    "skill-tree": [
        "................", "......KKKK......", ".....KGGGGK.....", "...KKGGgGGGKK...",
        "..KGGGGGGgGGGK..", "..KGgGGGGGGGGK..", "...KGGGGGgGGK...", "..KGGGgGGGGGGK..",
        "..KGGGGGGGGgGK..", "...KKGGGGGGKK...", ".....KKBBKK.....", ".......BB.......",
        ".......BB.......", "......BBBB......", ".....BBBBBB.....", "................",
    ],
    "inventory": [
        "................", "................", "...KKKKKKKKKK...", "..KPPPPPPPPPPK..",
        ".KPPPPPPPPPPPPK.", ".KPPPPPPPPPPPPK.", ".KKKKKKKKKKKKKK.", ".KLLLLLYYLLLLLK.",
        ".KLLLLKYYKLLLLK.", ".KLLLLLKKLLLLLK.", ".KLLLLLLLLLLLLK.", ".KLLLLLLLLLLLLK.",
        ".KKKKKKKKKKKKKK.", "................", "................", "................",
    ],
    "roadmap": [
        "................", "...KK...........", "...KWKKKKKK.....", "...KWPPPPPPK....",
        "...KWPPPPPPPK...", "...KWPPPPPPK....", "...KWKKKKKK.....", "...KW...........",
        "...KW...........", "...KW...........", "...KW...........", "..KKWK..........",
        ".KGGGGKKK.......", "KGGGGGGGGKKK....", "KGGGGGGGGGGGGK..", "KKKKKKKKKKKKKKK.",
    ],
    "contact": [
        "................", "................", "................", ".KKKKKKKKKKKKKK.",
        ".KWKWWWWWWWWKWK.", ".KWWKWWWWWWKWWK.", ".KWWWKWWWWKWWWK.", ".KWWWWKPPKWWWWK.",
        ".KWWWWWKKWWWWWK.", ".KWWWWWWWWWWWWK.", ".KWWWWWWWWWWWWK.", ".KKKKKKKKKKKKKK.",
        "................", "................", "................", "................",
    ],
}


def outlined(grid, solid="F", line="O"):
    """Add a 1px outline around `solid` pixels so a black sprite reads on dark tabs."""
    g = [list(r) for r in grid]
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == "." and any(0 <= y + dy < 16 and 0 <= x + dx < 16 and grid[y + dy][x + dx] == solid
                                 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g[y][x] = line
    return ["".join(r) for r in g]


def to_svg(grid, title):
    assert len(grid) == 16 and all(len(r) == 16 for r in grid), f"{title}: grid must be 16x16"
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


def composite():
    img = Image.new("RGBA", (W, H))
    for name in ("bg", "desk", "cat-tail-a", "cat-body", "cat-paws-rest", "cat-head", "cat-ear-a", "fg"):
        img.alpha_composite(Image.open(ASSETS / "scene" / f"{name}.png"))
    return img


def og_image():
    OW, OH = 1200, 630
    img = Image.new("RGB", (OW, OH), WALL)
    scene = composite().resize((W * 4, H * 4), Image.NEAREST)
    img.paste(scene, ((OW - W * 4) // 2, OH - H * 4), scene)
    d = ImageDraw.Draw(img)

    def font(size, bold=True):
        name = "DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf"
        try:
            return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size)
        except OSError:
            return ImageFont.load_default()

    def center(y, text, f, fill):
        w = d.textlength(text, font=f)
        d.text(((OW - w) / 2, y), text, font=f, fill=fill)

    center(34, "BLACK CAT // CYBER WORLD", font(22), "#f7a8c8")
    center(70, "NGUYỄN TUẤN MINH", font(60), "#fffaf0")
    center(146, "Cybersecurity · Detection Engineering · Exploring AI Engineering", font(22, False), "#c9bbf5")
    img.save(ASSETS / "og-image.png", optimize=True)


if __name__ == "__main__":
    for sub in ("scene", "icons"):
        (ASSETS / sub).mkdir(parents=True, exist_ok=True)
    background().save("bg")
    desk().save("desk")
    cat_layers()
    foreground().save("fg")
    (ASSETS / "favicon.svg").write_text(to_svg(outlined(CAT_FACE), "Black cat"))
    for name, grid in ICONS.items():
        (ASSETS / "icons" / f"{name}.svg").write_text(to_svg(grid, name))
    og_image()
    print("assets written to", ASSETS)
