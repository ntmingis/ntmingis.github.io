# Indie-Game Portfolio

A static, single-page portfolio in a cozy pixel-art / RPG style:
"cute on the surface, serious about engineering underneath."

There is no build step, no backend and no framework: plain HTML, CSS and JavaScript.

## Structure

```
index.html          page content (6 sections: profile, quests, skill tree, inventory, next quests, contact)
css/style.css       design tokens (light + dark), layout, responsive rules, reduced motion
js/config.js        YOUR PROFILE DATA: name, links, CV (edit this first)
js/main.js          fills/hides profile fields, theme toggle, case-study toggle, scroll reveal
assets/             avatar.svg, favicon.svg, og-image.png (generated)
tools/gen_assets.py regenerates the pixel-art assets (Pillow needed for og-image.png)
tools/check_site.py pre-publish checks: anchors, files, external URLs, contrast, leak scan
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
5. **Avatar / favicon / OG image:** edit the grids in `tools/gen_assets.py`, then run
   `python3 tools/gen_assets.py`.

## Run locally

```bash
cd indie-game-portfolio
python3 -m http.server 8931 --bind 127.0.0.1
# open http://127.0.0.1:8931/
```

Opening `index.html` directly also works, apart from the Google Font (the page falls back to a monospace font).

## Before every publish

```bash
python3 tools/check_site.py     # must print "OK: all checks passed"
git status --short              # review exactly what will be committed
```

Do not commit raw lab logs, grades, student ID, tokens, `.env` files or machine paths.

## Updating the live site

See `DEPLOY.md`. In short: edit, run the check, `git add -A && git commit -m "..." && git push`.
GitHub Pages redeploys automatically in about a minute.
