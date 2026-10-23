#!/usr/bin/env python3
"""Pre-publish checks: anchors, local files, external links, contrast, leaks.

Run from the repo root:  python3 tools/check_site.py
Exits non-zero if any check fails.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
fails = []


class Collect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.refs, self.blank, self.dialogs, self.hud = set(), [], [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append((tag, a[key]))
        if tag == "a" and a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
            self.blank.append(a.get("href"))
        if tag == "meta" and a.get("property") == "og:image":
            self.refs.append(("meta", a["content"]))
        if tag == "dialog":
            self.dialogs.append(a)
        if tag == "a" and "hud-item" in (a.get("class") or ""):
            self.hud.append(a.get("href"))


html = (ROOT / "index.html").read_text()
p = Collect()
p.feed(html)

for tag, ref in p.refs:
    if ref.startswith("#"):
        if ref[1:] not in p.ids:
            fails.append(f"broken anchor {ref}")
    elif not re.match(r"^(https?:|mailto:)", ref):
        if not (ROOT / ref).is_file():
            fails.append(f"missing local file {ref}")
for href in p.blank:
    fails.append(f"target=_blank without rel=noopener: {href}")

# The five public section anchors (https://ntmingis.github.io/portfolio-tm/#...) must exist,
# and the quest menu must link exactly to them and start closed (hidden until clicked).
SECTIONS = ["inventory", "quests", "skill-tree", "roadmap", "contact"]
for sid in SECTIONS:
    if sid not in p.ids:
        fails.append(f"missing section id #{sid}")
if p.hud != ["#" + s for s in SECTIONS]:
    fails.append(f"quest menu links {p.hud} != {SECTIONS}")
for d in p.dialogs:
    if "open" in d:
        fails.append(f"dialog #{d.get('id')} is open in the markup")

# Every url(...) in the stylesheet must be a relative file that exists (GitHub Pages
# serves the site from /portfolio-tm/, so no root-absolute or external URLs).
css_text = (ROOT / "css/style.css").read_text()
for u in re.findall(r"url\(\s*[\"']?([^\"')]+)", css_text):
    if u.startswith(("data:", "#")):
        continue
    if u.startswith(("/", "http:", "https:")):
        fails.append(f"non-relative url() in CSS: {u}")
    elif not (ROOT / "css" / u).resolve().is_file():
        fails.append(f"missing CSS asset {u}")
for tag, ref in p.refs:
    if ref.startswith("/"):
        fails.append(f"root-absolute path breaks on project Pages: {ref}")

ext = sorted({r for _, r in p.refs if r.startswith("http")})
allowed = ("https://ntmingis.github.io/portfolio-tm/",
           "https://www.facebook.com/ntming24/", "https://www.instagram.com/tnmingis/")
for r in ext:
    if not r.startswith(allowed):
        fails.append(f"unexpected external URL {r}")

# --- intro scene: layer PNGs, stacking order, pose wiring, level label ---
if "JUNIOR" not in html or "LV. Student" in html:
    fails.append("intro level label must be JUNIOR (not LV. Student)")
stage = html.split('<div class="stage"', 1)[1].split('<div class="prompt">', 1)[0]
order = re.findall(r'class="(lyr-bg|fx-sky|fx-moon|lyr-desk|crt|fx-crt-light|poses|cat|fx-dust|lyr-fg)[" ]', stage
                   .replace('class="lyr lyr-', 'class="lyr-'))
want = ["lyr-bg", "fx-sky", "fx-moon", "lyr-desk", "crt", "fx-crt-light", "poses", "cat", "fx-dust", "lyr-fg"]
if order != want:
    fails.append(f"scene layer order {order} != {want}")
scene_refs = re.findall(r'src="(assets/scene/[\w-]+\.png)"', html)
on_disk = sorted(f"assets/scene/{f.name}" for f in (ROOT / "assets/scene").glob("*.png"))
for orphan in sorted(set(on_disk) - set(scene_refs)):
    fails.append(f"scene PNG not used by the page: {orphan}")
try:
    from PIL import Image
    masks = {}
    for ref in scene_refs:
        im = Image.open(ROOT / ref)
        if im.format != "PNG" or im.size != (192, 108) or im.mode != "RGBA":
            fails.append(f"{ref}: {im.format} {im.size} {im.mode}, want PNG 192x108 RGBA")
        alpha = im.convert("RGBA").getchannel("A")
        if not alpha.getbbox():
            fails.append(f"{ref}: fully transparent")
        masks[ref] = alpha.tobytes()
    poses = re.findall(r'class="lyr pose pose-([\w-]+)" src="assets/scene/cat-pose-([\w-]+)\.png"', html)
    seated = Image.new("L", (192, 108))
    for n in ("cat-body", "cat-head", "cat-paws-rest", "cat-tail-a"):
        seated.paste(255, mask=Image.open(ROOT / f"assets/scene/{n}.png").getchannel("A"))
    seen = {}
    for cls, file in poses:
        if cls != file:
            fails.append(f"pose class pose-{cls} shows cat-pose-{file}.png")
        m = masks[f"assets/scene/cat-pose-{file}.png"]
        if m in seen or m == seated.tobytes():
            fails.append(f"pose {file} has the same silhouette as {seen.get(m, 'the seated cat')}")
        seen[m] = file
except ImportError:
    fails.append("Pillow is needed to check the scene PNGs (pip install Pillow)")
js = (ROOT / "js/intro.js").read_text()
used = set(re.findall(r'"pose:([\w-]+)"', js)) | set(re.findall(r'pose\("([\w-]+)"\)', js))
for name in sorted(used):
    if f'[data-pose="{name}"]' not in css_text:
        fails.append(f"pose {name} is set by intro.js but has no CSS rule")
    if name != "type" and f"pose-{name}" not in html:
        fails.append(f"pose {name} is set by intro.js but has no frame in index.html")
print(f"scene: {len(scene_refs)} PNG layers, poses {[f for _, f in poses]}, timeline poses {sorted(used)}")


# --- contrast (WCAG AA 4.5:1 for text) ---
def lum(hexc):
    h = hexc.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


css = (ROOT / "css/style.css").read_text()


def tokens(block):
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", block))


light = tokens(css.split("@media (prefers-color-scheme: dark)")[0])
dark = tokens(css.split(':root[data-theme="dark"]')[1].split("}")[0])
pairs = [("ink", "bg"), ("ink", "surface"), ("ink", "surface-2"), ("muted", "bg"), ("muted", "surface"),
         ("muted", "surface-2"), ("pink-ink", "bg"), ("pink-ink", "surface"), ("pink-ink", "surface-2"),
         ("lav-ink", "surface"), ("lav-ink", "surface-2"), ("mint-ink", "mint"), ("cream-ink", "cream-chip")]
for name, t in (("light", light), ("dark", dark)):
    worst = min((ratio(t[a], t[b]), a, b) for a, b in pairs)
    print(f"contrast {name}: worst {worst[1]} on {worst[2]} = {worst[0]:.2f}:1")
    for a, b in pairs:
        r = ratio(t[a], t[b])
        if r < 4.5:
            fails.append(f"contrast {name} {a}/{b} = {r:.2f}")
night = tokens(css.split(":root {")[1].split("}")[0])
hud_bgs = {"wall": night["night-wall"], "hud-top": "#261b4a", "black": "#0b0814"}
for fg in ("night-ink", "night-lav", "night-dim", "night-pink", "night-mint", "night-crt"):
    for bgname, bg in hud_bgs.items():
        r = ratio(night[fg], bg)
        if r < 4.5:
            fails.append(f"contrast night {fg}/{bgname} = {r:.2f}")
print("contrast night: worst", f"{min(ratio(night[f], b) for f in ('night-ink', 'night-lav', 'night-dim', 'night-pink', 'night-mint', 'night-crt') for b in hud_bgs.values()):.2f}:1")
r = ratio("#241a3d", "#f7a8c8")
print(f"contrast pink buttons: {r:.2f}:1")
if r < 4.5:
    fails.append("pink button contrast")

# --- leak scan over every text file that would be published ---
leak = re.compile(
    r"/home/|/root/|\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+\b|MSSV|"
    r"ghp_[A-Za-z0-9]{20,}|github_pat_|BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]|"
    r"\[YOUR NAME\]|example\.com|@gmail\.com", re.I)
for f in ROOT.rglob("*"):
    if f.is_file() and ".git" not in f.parts and f.suffix in {".html", ".css", ".js", ".svg", ".md", ".txt", ".py"}:
        if f.name == "check_site.py":
            continue
        for n, line in enumerate(f.read_text(errors="replace").splitlines(), 1):
            if leak.search(line):
                fails.append(f"possible leak {f.relative_to(ROOT)}:{n}: {line.strip()[:80]}")

print(f"ids={len(p.ids)} refs={len(p.refs)} external={len(ext)}")
if fails:
    print("FAIL")
    print("\n".join(" - " + x for x in fails))
    sys.exit(1)
print("OK: all checks passed")
