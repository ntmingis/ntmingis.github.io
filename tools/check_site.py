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
        self.ids, self.refs, self.blank = set(), [], []

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

ext = sorted({r for _, r in p.refs if r.startswith("http")})
allowed = ("https://fonts.googleapis.com", "https://fonts.gstatic.com",
           "https://www.facebook.com/ntming24/", "https://www.instagram.com/tnmingis/")
for r in ext:
    if not r.startswith(allowed):
        fails.append(f"unexpected external URL {r}")


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
