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

## Hero: the cat in the machine

`js/hero.js` draws a black cat out of falling green code inside a terminal window (Canvas 2D, no libraries).

- Eyes follow the cursor; one paw swipes when the cursor comes within reach; click to pounce.
- Four butterflies roam the screen; the cat swipes at them when awake.
- It keeps Minh's hours (GMT+7): study 12:00–22:00 (types notes on a keyboard), sleep 22:00–05:00, awake 05:00–12:00.
  Visitors can override with the Auto / Awake / Study / Sleep buttons or terminal commands.
- Terminal commands: `help`, `whoami`, `study`, `stop`, `sleep`, `wake`, `auto`, `schedule`, `pounce`, `clear`
  (also `học`, `ngủ`, `dậy`). Output is built with `textContent`, never parsed as HTML.
- Pauses when off screen or the tab is hidden; `prefers-reduced-motion` shows a still frame;
  without JavaScript the screen shows `assets/cat-poster.png`.
- `?cat=awake|study|sleep` pins the state (used by `tools/make_og.py`).

## Layout

```
index.html            all content
css/style.css         theme tokens (dark default + light), layout
js/theme-init.js      applies saved theme before first paint
js/config.js          PROFILE: contact links, certifications (the file to edit)
js/main.js            link validation, theme toggle, active nav link
js/hero.js            the cat hero (see above)
assets/               favicon, og-image.png, cat-poster.png, VT323 font (SIL OFL)
tools/check_site.py   pre-publish checks
tools/make_og.py      re-renders og-image.png and cat-poster.png from the live hero
tools/serve.py        local preview server with Range support
```

## Security notes

- CSP via `<meta>`: `default-src 'none'`, scripts, styles, images and fonts from `'self'` only. So there is no inline script, style attribute or third-party request anywhere.
- The hero terminal builds output with `textContent`. Visitor input is never parsed as HTML.
- `config.js` links are validated (https only, expected host), and invalid values are hidden instead of rendered.
- GitHub Pages cannot set response headers, so `frame-ancestors` and HSTS are out of scope for this site.

## Before every push

```bash
python3 tools/check_site.py
```

It checks anchors, local files, `rel=noopener`, CSP compatibility, canonical/og URLs, WCAG contrast of both themes, and obvious secret leaks.
