# Deploying

Repository `ntmingis/ntmingis.github.io` is a GitHub **user site**: Pages serves branch `main`, folder `/` (root)
at <https://ntmingis.github.io/>. `.nojekyll` disables Jekyll. No Actions workflow is needed.

## Update the site

```bash
git clone https://github.com/ntmingis/ntmingis.github.io.git
cd ntmingis.github.io
# edit js/config.js or index.html ...
python3 tools/check_site.py      # must print "OK: all checks passed"
git status --short
git add -A
git commit -m "Describe the change"
git pull --rebase                 # in case you edited on github.com
git push                          # Pages redeploys in about a minute
```

Never `git push --force` on `main`.

## Verify

```bash
curl -sI https://ntmingis.github.io/ | head -1              # expect HTTP/2 200
curl -sI https://ntmingis.github.io/js/main.js | head -1
```

Then open the site with DevTools → Console: there must be no CSP violation messages.

## Social preview

`canonical`, `og:url` and `og:image` in `index.html` are absolute URLs on `https://ntmingis.github.io/`.
After changing the hero text, regenerate the image with `python3 tools/make_og.py`.
Facebook caches previews; refresh it in the Sharing Debugger.
