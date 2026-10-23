# BLACK CAT // CYBER WORLD

Portfolio of Nguyễn Tuấn Minh, live at <https://ntmingis.github.io/portfolio-tm/>.
It opens like an indie-game intro: a pixel-art black cat walks to a night-time desk,
starts typing on a CRT, the name appears, and a quest menu leads to the sections
(`#quests`, `#skill-tree`, `#inventory`, `#roadmap`, `#contact`).

There is no build step, no backend and no framework: plain HTML, CSS and JavaScript.

## Structure

```
index.html          intro scene (#profile), quest menu <dialog>, about + the 5 content sections
css/style.css       tokens (light/dark + night palette), self-hosted fonts, intro scene,
                    opening-sequence states, HUD menu, responsive rules, reduced motion
js/config.js        YOUR PROFILE DATA: name, links, CV (edit this first)
js/main.js          fills/hides profile fields, theme toggle, case-study toggle, scroll reveal
js/intro.js         opening sequence, Skip/Replay, quest menu (keyboard: Tab, ↑↓, Enter, Esc),
                    CRT terminal text, optional Web Audio sound (off by default)
assets/scene/       192x108 pixel-art layers (room, desk, cat frames) stacked by the page;
                    cat-pose-*.png are the opening moves (sit, stand, crouch, leap, fall,
                    land, sitdown), one drawing per pose
assets/icons/       16x16 quest-menu icons
assets/fonts/       Pixelify Sans + VT323 (SIL OFL, licences included)
assets/             favicon.svg, og-image.png (generated)
tools/gen_assets.py regenerates every pixel-art asset (needs Pillow)
tools/check_site.py pre-publish checks: anchors, quest-menu links, files, CSS urls,
                    external URLs, contrast, leak scan
.nojekyll           tells GitHub Pages to serve files as-is
```

## Editing content

1. **Profile and links:** edit `js/config.js`. Empty or invalid fields are hidden
   automatically (URLs must be `https://`; GitHub/LinkedIn/Facebook/Instagram links
   must point to their own domains). Nothing fake ever renders.
2. **CV:** put the PDF at `assets/cv.pdf` and set `cv: "assets/cv.pdf"`.
3. **Projects, courses, skills, roadmap:** edit the matching `<section>` in `index.html`.
   Keep to claims you can back with evidence; label future work as *Next quest*.
4. **Colors:** change the tokens at the top of `css/style.css` (the light set, then the
   dark set, which appears twice: once for the system preference and once for the toggle).
5. **Scene, cat, icons, favicon, OG image:** edit `tools/gen_assets.py` (shapes and
   palettes are at the top), then run `python3 tools/gen_assets.py`.
6. **Intro timing:** `TIMELINE` in `js/intro.js` (about 5 s in total): CRT boot, the cat
   stands up on the window sill, jumps down onto the desk, lands, sits and types, then the
   name, `JUNIOR` label, headline and quest button appear. `pose:<name>` entries set
   `data-pose` on `.intro`, which shows `cat-pose-<name>.png`. The intro is
   skipped for deep links (`#quests` …), for `prefers-reduced-motion`, and after the
   first play in a browser session; "Replay intro" plays it again.

## Run locally

```bash
cd indie-game-portfolio
python3 -m http.server 8931 --bind 127.0.0.1
# open http://127.0.0.1:8931/
```

Opening `index.html` directly also works. Nothing is loaded from other domains.

## Before every publish

```bash
python3 tools/check_site.py     # must print "OK: all checks passed"
git status --short              # review exactly what will be committed
```

Do not commit raw lab logs, grades, student ID, tokens, `.env` files or machine paths.

## Updating the live site

See `DEPLOY.md`. In short: edit, run the check, `git add -A && git commit -m "..." && git push`.
GitHub Pages redeploys automatically in about a minute.
