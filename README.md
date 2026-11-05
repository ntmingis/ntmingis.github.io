# ntmingis.github.io

Personal portfolio of Nguyễn Tuấn Minh, an Information Security student at FPT University building toward AI security.
Live: <https://ntmingis.github.io/>

Static HTML/CSS/JS. No framework, no build step, no trackers, no cookies.

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

## Layout

```
index.html            all content
css/style.css         theme tokens (dark default + light), layout
js/theme-init.js      applies saved theme before first paint
js/config.js          PROFILE: contact links, certifications (the file to edit)
js/main.js            link validation, theme toggle, interactive terminal
assets/               favicon, og-image.png, VT323 font (SIL OFL)
tools/check_site.py   pre-publish checks
tools/make_og.py      regenerates assets/og-image.png (Playwright)
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
