#!/usr/bin/env python3
"""Pre-publish checks for the static site. Exits non-zero if anything fails.

Run from anywhere:  python3 tools/check_site.py

Checks: internal anchors, local file references, target=_blank hygiene,
CSP compatibility (no inline script/style), canonical/og URLs, WCAG contrast
of the colour tokens in both themes, and obvious secret leaks.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://ntmingis.github.io/"
fails = []


class Collect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.refs, self.blank, self.inline = set(), [], [], []
        self.meta, self.canonical, self.in_script = {}, None, False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            if a["id"] in self.ids:
                fails.append(f"duplicate id #{a['id']}")
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append((tag, a[key]))
        if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
            self.blank.append(a.get("href") or a.get("data-field"))
        if "style" in a:
            self.inline.append(f"style attribute on <{tag}>")
        if any(k.startswith("on") for k in a):
            self.inline.append(f"inline event handler on <{tag}>")
        if tag == "style":
            self.inline.append("<style> element")
        if tag == "script":
            if not a.get("src"):
                self.in_script = True
        key = a.get("property") or a.get("name") or a.get("http-equiv")
        if tag == "meta" and key:
            self.meta[key] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")

    def handle_data(self, data):
        if self.in_script and data.strip():
            self.inline.append("inline <script>")

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_script = False


html = (ROOT / "index.html").read_text(encoding="utf-8")
p = Collect()
p.feed(html)

# 1. anchors and local files
for tag, ref in p.refs:
    if ref.startswith("#"):
        if ref[1:] not in p.ids:
            fails.append(f"broken anchor {ref}")
    elif not re.match(r"^(https?:|mailto:)", ref):
        if not (ROOT / ref).is_file():
            fails.append(f"missing local file {ref}")
for href in p.blank:
    fails.append(f"target=_blank without rel=noopener: {href}")

# 2. CSP: the meta policy forbids inline code, so none may exist
csp = p.meta.get("Content-Security-Policy", "")
if "default-src 'none'" not in csp or "'unsafe-inline'" in csp:
    fails.append("CSP meta missing or weakened")
for item in p.inline:
    fails.append(f"CSP would block: {item}")
for js in (ROOT / "js").rglob("*.js"):
    src = js.read_text(encoding="utf-8")
    if re.search(r"\.innerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function", src):
        fails.append(f"{js.name}: HTML/code injection sink")
    if re.search(r"setAttribute\(\s*['\"]style", src):
        fails.append(f"{js.name}: style attribute blocked by CSP")

# 3. canonical + social preview point at this repo's Pages URL
if p.canonical != SITE:
    fails.append(f"canonical {p.canonical} != {SITE}")
if p.meta.get("og:url") != SITE:
    fails.append(f"og:url {p.meta.get('og:url')} != {SITE}")
og = p.meta.get("og:image", "")
if not og.startswith(SITE) or not (ROOT / og[len(SITE):]).is_file():
    fails.append(f"og:image not a file in this repo: {og}")

# 4. contrast of design tokens (WCAG 2.x)
css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")


def block(selector):
    m = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", css)
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", m.group(1))) if m else {}


def lum(hexcol):
    rgb = [int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


dark = block(":root")
light = {**dark, **block(':root[data-theme="light"]')}
PAIRS = [("text", "bg"), ("text", "panel"), ("muted", "bg"), ("muted", "panel"), ("muted", "bg-2"),
         ("accent", "bg"), ("accent", "panel"), ("accent", "bg-2"), ("accent-ink", "accent-strong"),
         ("verified", "panel"), ("course", "panel"), ("learning", "panel"), ("planned", "panel"),
         ("risk", "panel"), ("ember", "panel")]
for theme, t in (("dark", dark), ("light", light)):
    worst = min((ratio(t[f], t[b]), f, b) for f, b in PAIRS)
    if worst[0] < 4.5:
        fails.append(f"contrast {theme}: {worst[1]} on {worst[2]} = {worst[0]:.2f}:1 < 4.5")
    print(f"contrast {theme}: worst {worst[1]} on {worst[2]} = {worst[0]:.2f}:1")
# terminal window is always dark
for fg in ("#cfe8d6", "#7d978a", "#45c486", "#f2b950", "#ff7a85", "#67c8e6"):
    if ratio(fg, "#070908") < 4.5:
        fails.append(f"terminal contrast {fg} < 4.5")
# hero is always dark (#050505) whatever the page theme
for fg in ("#ece7e1", "#b3ada6", "#e5596b", "#f5f0ea", "#45c486", "#8d8a85"):
    if ratio(fg, "#050505") < 4.5:
        fails.append(f"hero contrast {fg} < 4.5")
# light tokens must also be duplicated identically in the prefers-color-scheme block
media = re.search(r'@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme="dark"\]\)\s*\{([^}]*)\}', css)
if not media or dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", media.group(1))) != block(':root[data-theme="light"]'):
    fails.append("light theme tokens differ between [data-theme=light] and prefers-color-scheme block")

for ref in re.findall(r'url\("?(\.\./[^")]+)"?\)', css):
    if not (ROOT / "css" / ref).resolve().is_file():
        fails.append(f"css references missing file {ref}")

# 5. leaks / stale references
for path in [ROOT / "index.html", *ROOT.rglob("js/**/*.js"), *ROOT.glob("css/*.css")]:
    text = path.read_text(encoding="utf-8")
    if "portfolio-tm" in text:
        fails.append(f"{path.name}: stale reference to portfolio-tm")
    if re.search(r"-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}", text):
        fails.append(f"{path.name}: looks like a secret")

print(f"ids={len(p.ids)} refs={len(p.refs)}")
if fails:
    print("FAIL:\n  " + "\n  ".join(fails))
    sys.exit(1)
print("OK: all checks passed")
