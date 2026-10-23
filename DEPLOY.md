# Deploying to GitHub Pages

Live site: <https://ntmingis.github.io/portfolio-tm/> from the repository
**`ntmingis/portfolio-tm`**. Publishing source: **branch `main`, folder `/` (root)**. No GitHub Actions workflow
is needed; Pages serves the static files directly (`.nojekyll` disables Jekyll processing).

## One-time setup (this folder → the existing repo)

```bash
# 1. Log in to GitHub CLI (browser/device flow; never paste tokens anywhere)
gh auth login            # GitHub.com → HTTPS → Login with a web browser
gh auth setup-git        # let git push over HTTPS using the gh login

# 2. Commit identity (the GitHub "noreply" email keeps your address private)
git config --global user.name  "<your name>"
git config --global user.email "<id>+<username>@users.noreply.github.com"

# 3. Connect to ntmingis/portfolio-tm and adopt its history (keeps your working files)
cd ~/lab/indie-game-portfolio
git remote -v                                   # add origin only if it is missing:
git remote add origin https://github.com/ntmingis/portfolio-tm.git
git fetch origin
git reset origin/main                           # mixed reset: HEAD+index = live site, files untouched
git status --short                              # = exactly what will change on the live site
```

Pages is already enabled (main / root). Without the CLI: repo **Settings → Pages →
Build and deployment → Source: Deploy from a branch → `main` / `/ (root)`**.

## Verify the deployment

```bash
gh api repos/ntmingis/portfolio-tm/pages --jq '.html_url, .status'
gh api repos/ntmingis/portfolio-tm/pages/builds/latest --jq '.status, .error.message'
curl -sI https://ntmingis.github.io/portfolio-tm/ | head -1        # expect HTTP/2 200
curl -sI https://ntmingis.github.io/portfolio-tm/js/intro.js | head -1
```

Status goes `queued → building → built`. Always take the URL from `html_url`; don't guess it.
If the build fails, `gh run list` / `gh run view --log-failed` shows the
`pages-build-deployment` log.

## Updating later

```bash
cd ~/lab/indie-game-portfolio
# edit js/config.js or index.html ...
python3 tools/check_site.py
git status --short
git add -A
git commit -m "Update projects section"
git pull --rebase       # in case you edited on github.com
git push                # Pages redeploys automatically (~1 min)
```

Never use `git push --force` on `main`.

## Social preview

`og:image` and `og:url` in `index.html` are absolute URLs on
`https://ntmingis.github.io/portfolio-tm/`; update them if the site ever moves.

## Custom domain (optional)

Add a `CNAME` file containing the domain, set DNS per GitHub's Pages docs, and tick
"Enforce HTTPS" in Settings → Pages.
