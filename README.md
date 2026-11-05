# ntmingis.github.io

Personal portfolio of Nguyễn Tuấn Minh, an Information Security student at FPT University building toward AI security.
Live: <https://ntmingis.github.io/>

Static HTML/CSS/JS. No framework, no build step, no dependencies, no trackers, no cookies.

Run locally (ES modules need HTTP, not `file://`; the hero video needs Range requests):

```bash
python tools/serve.py 8000      # then open http://localhost:8000/
```

## Content rule

Every claim on the site carries how it is known:

| Tag | Meaning |
|---|---|
| `[verified]` | Used in a documented lab with recorded results |
| `[coursework]` | Passed university course |
| `[learning]` | Studying; no lab result yet |
| `[planned]` | Not started; question and metric written in advance |
| `[hypothesis]` | Reasoned but untested |

A lab moves from `[planned]` to `[verified]` only after its raw evidence exists and the result, including false positives and limits, is written up.

## Hero scene

The hero is a Canvas 2D animation, written from scratch with no libraries (`js/scene/`):

| File | Role |
|---|---|
| `timeline.js` | Deterministic state machine: `arrival → sword_draw → sword_swing → sheathing → walk_to_fire → sitting → idle`, 30 s loop, keyframed poses with per-segment easing |
| `knight.js` | 2D skeleton with two-bone IK for arms and legs; armour, helm, sword and scabbard drawn as vector paths |
| `cloak.js` | Cloak simulated as two verlet chains (fixed 60 Hz step), collides with body, ground and rock |
| `matrix.js` | Background of tiny green glyphs (0-9 a-z A-Z) in three depth layers, rendered from glyph atlases at 24 fps |
| `fx.js` | Campfire, embers, smoke, sword trail, footstep ash, glyphs shed while the knight materialises |
| `scene.js` | Canvas sizing and DPR budget, render loop, quality tiers, pause/visibility, reduced motion, cleanup |

- Quality steps down automatically when frames get slow (fewer glyph columns, lower resolution).
- The loop pauses when the hero is off screen or the tab is hidden; a *Pause scene* button stops it entirely.
- `prefers-reduced-motion`: one static frame of the resting knight, no loop.
- No JavaScript or no canvas: `assets/knight-poster.jpg` is shown instead.
- `?scene=<seconds>` freezes the scene at a given time (used to render the stills); `?scene-debug` exposes `window.__scene` for testing.

## Hero film (AI video)

When `js/scene/video-manifest.js` is not `null`, the hero plays a pre-rendered knight film
instead of the procedural knight, with the digital rain drawn on top. The rain is kept off
the figure by an occupancy grid computed from the film.

1. Put the raw clips in `media-src/` (ignored by git) and describe them in `media-src/clips.json`
   (format in the docstring of `tools/prepare_video.py`).
2. `python tools/prepare_video.py media-src/clips.json` (needs ffmpeg with libvpx-vp9 and libx264, numpy).
   It writes `assets/hero/knight.webm`, `assets/hero/knight.mp4`, `assets/knight-poster.jpg`
   and the manifest.
3. `python tools/make_og.py` to refresh the social preview.

To go back to the procedural scene, set the manifest to `export default null;`.

## Layout

```
index.html            all content
css/style.css         theme tokens (dark default + light), layout
js/theme-init.js      applies saved theme before first paint
js/config.js          PROFILE: contact links, certifications (the file to edit)
js/main.js            link validation, theme toggle, interactive terminal
js/scene/             hero animation (ES modules, see above); video.js + video-manifest.js for the hero film
assets/               favicon, og-image.png, knight-poster.jpg, VT323 font (SIL OFL)
tools/check_site.py   pre-publish checks
tools/make_og.py      re-renders og-image.png (and the poster in procedural mode) from the live scene
tools/prepare_video.py builds the hero film, poster and manifest from raw clips
tools/serve.py        local preview server with Range support
```

## Security notes

- CSP via `<meta>`: `default-src 'none'`, scripts, styles, images and fonts from `'self'` only. So there is no inline script, style attribute or third-party request anywhere.
- The interactive terminal builds output with `textContent`. Visitor input is never parsed as HTML.
- `config.js` links are validated (https only, expected host), and invalid values are hidden instead of rendered.
- GitHub Pages cannot set response headers, so `frame-ancestors` and HSTS are out of scope for this site.

## Before every push

```bash
python3 tools/check_site.py
```

It checks anchors, local files, `rel=noopener`, CSP compatibility, canonical/og URLs, WCAG contrast of both themes, and obvious secret leaks.
