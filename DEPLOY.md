# Deploying to GitHub Pages

Publishing source: **branch `main`, folder `/` (root)**. No GitHub Actions workflow
is needed; Pages serves the static files directly (`.nojekyll` disables Jekyll processing).

## One-time setup

```bash
# 1. Install and log in to GitHub CLI (browser/device flow; never paste tokens anywhere)
gh auth login            # GitHub.com → HTTPS → Login with a web browser
gh auth setup-git        # let git push over HTTPS using the gh login

# 2. Set your commit identity (use the GitHub "noreply" email to keep your address private)
git config --global user.name  "<your name>"
git config --global user.email "<id>+<username>@users.noreply.github.com"

# 3. Create the public repo from this folder and push main
cd indie-game-portfolio
git init -b main
git add -A && git commit -m "Initial portfolio"
gh repo create indie-game-portfolio --public --source . --remote origin --push

# 4. Enable Pages from main / root
gh api -X POST repos/{owner}/indie-game-portfolio/pages \
  -f "source[branch]=main" -f "source[path]=/"
```

Without the CLI: repo **Settings → Pages → Build and deployment → Source: Deploy from a
branch → `main` / `/ (root)` → Save**.

## Verify the deployment

```bash
gh api repos/{owner}/indie-game-portfolio/pages --jq '.html_url, .status'
gh api repos/{owner}/indie-game-portfolio/pages/builds/latest --jq '.status, .error.message'
curl -sI https://<username>.github.io/indie-game-portfolio/ | head -1     # expect HTTP/2 200
```

Status goes `queued → building → built`. Always take the URL from `html_url`; don't guess it.
If the build fails, `gh run list` / `gh run view --log-failed` shows the
`pages-build-deployment` log.

## Updating later

```bash
cd indie-game-portfolio
# edit js/config.js or index.html ...
python3 tools/check_site.py
git status --short
git add -A
git commit -m "Update projects section"
git pull --rebase       # in case you edited on github.com
git push                # Pages redeploys automatically (~1 min)
```

Never use `git push --force` on `main`.

## Social preview (optional)

After the URL is live, make `og:image` absolute in `index.html` so link previews show
the image, e.g. `https://<username>.github.io/indie-game-portfolio/assets/og-image.png`,
and add `<meta property="og:url" content="https://<username>.github.io/indie-game-portfolio/">`.

## Custom domain (optional)

Add a `CNAME` file containing the domain, set DNS per GitHub's Pages docs, and tick
"Enforce HTTPS" in Settings → Pages.
