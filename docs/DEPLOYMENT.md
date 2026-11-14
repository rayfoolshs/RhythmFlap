# Deployment

Rhythm Flap is a static site. It builds to `dist/` with Vite and is published to
GitHub Pages by GitHub Actions on every push to `main`.

- **Live site:** <https://rayfoolshs.github.io/RhythmFlap/>
- **Workflow:** [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
- **Pages build type:** `workflow` (not the legacy Jekyll builder)

## Why a build step is required

The repository root `index.html` is a Vite entry point, not a deployable page:

```html
<script type="module" src="/src/main.tsx"></script>
```

Browsers cannot execute `.tsx`, and `/src/main.tsx` is not served from a Pages
artifact. Serving the repository root — which is what the legacy Pages builder
does — returns HTTP 200 with a blank page and a console error. The site must be
built first so that the entry becomes hashed JS in `dist/`.

## Base path

Project sites live under `/<repo>/`, so `/RhythmFlap/` here. A bundle built with
the default base `/` requests `/assets/index-*.js`, which 404s at that subpath.

`vite.config.ts` reads the base from the environment:

```ts
base: process.env.PAGES_BASE ?? '/',
```

The workflow sets it from the repository name, so the same config works for a
local build at `/`, a project site, or a user site:

```yaml
env:
  PAGES_BASE: /${{ github.event.repository.name }}/
```

To check a production build locally:

```bash
PAGES_BASE=/RhythmFlap/ npm run build
grep -E 'script type|stylesheet' dist/index.html   # paths must start with /RhythmFlap/
```

## Pipeline

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

1. **Install** — `npm ci` from the committed `package-lock.json`.
2. **Type check** — `npm run lint` (`tsc --noEmit`). Gates the deploy.
3. **Build** — `npm run build` with `PAGES_BASE` set.
4. **Configure / upload** — `actions/configure-pages`, `actions/upload-pages-artifact` from `dist`.
5. **Deploy** — `actions/deploy-pages` into the `github-pages` environment.

Permissions are the minimum the flow needs (`contents: read`, `pages: write`,
`id-token: write`), and `concurrency` cancels superseded runs.

## First-time setup

Pages must exist and be set to the workflow builder before the first deploy:

```bash
gh api --method POST repos/OWNER/REPO/pages \
  -f 'source[branch]=main' -f 'source[path]=/'

gh api --method PUT repos/OWNER/REPO/pages -f 'build_type=workflow'
```

Verify:

```bash
gh api repos/OWNER/REPO/pages --jq '{build_type,html_url,status}'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Site loads, page is blank | Deployed repo root instead of `dist` | Confirm `build_type` is `workflow` and the artifact path is `dist` |
| Blank page, `/src/main.tsx` 404 in console | Legacy builder served the Vite entry | Switch to `build_type=workflow` |
| Assets 404 under `/RhythmFlap/` | Base path not set | Set `PAGES_BASE` in the build step |
| `ERESOLVE` during `npm ci` | Dependency peer conflict | Resolve the peer range; do not paper over with `--legacy-peer-deps` in CI |
| Deploy skipped | Pages not enabled, or environment approval pending | Re-run `workflow_dispatch`, check the `github-pages` environment |

## Verifying a deploy

```bash
gh run list --limit 3
gh run watch <run-id> --exit-status

curl -sS -o /dev/null -w '%{http_code}\n' https://rayfoolshs.github.io/RhythmFlap/
curl -sS https://rayfoolshs.github.io/RhythmFlap/ | grep -E 'script type|stylesheet'
```

An HTTP 200 on the page is not proof the app works — check that the referenced
JS and CSS return 200, then load the page and confirm the React root renders with
no console errors.

## Rollback

Redeploy an earlier commit without rewriting history:

```bash
git revert <bad-commit> && git push origin main
```

The push triggers a fresh deploy of the reverted tree. To redeploy the current
tree without a new commit, run the workflow manually:

```bash
gh workflow run deploy.yml
```
