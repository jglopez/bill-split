# Bill Split

An itemized bill-splitting tool. Add participants, enter line items, assign them to specific people, apply tax and tip, and see exactly what each person owes.

---

## Features

- Add/remove participants inline on the same screen as items
- Itemized line items with per-person assignment (checkboxes)
- Tax, tip, and additional fees/discounts split proportionally
- Tip and fee rows can be calculated on pre-tax or post-tax subtotal
- Multi-payer support: one person paid, or split payment across multiple people
- Settlement: minimal set of transactions to settle all debts
- Share section: share or copy a link to the app through the phone's share sheet, or the clipboard on desktop
- Share a plain-text summary of who owes whom through the share sheet, or copy it, ready to paste into a group chat. The wording lives in a template, `src/share/summary/default.liquid`
- Session auto-saves to localStorage (survives page refresh)
- Fully responsive — works on Safari on iOS, Chrome for Android, and desktop

---

## Running locally

```bash
nvm use   # picks up the version from .nvmrc (or: fnm use)
npm install
npm run dev
```

The URL will be shown in the terminal output.

Other scripts:

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build locally
npm run preview:worker  # build, then serve it the way Cloudflare does (wrangler dev)
npm run typecheck  # run TypeScript without emitting files
npm run lint       # run ESLint on src/
npm test           # run the unit tests
```

### Docker

**Dev** (hot reload, source mounted as a volume):

```bash
docker compose up
# → check `docker compose ps` for the assigned host port
```

**Prod** (static build served by nginx):

```bash
docker build --target prod -t bill-split .
docker run -p 8080:8080 bill-split
# → http://localhost:8080
```

---

## Deployment

The app is a static build served by a [Cloudflare Worker with static assets](https://developers.cloudflare.com/workers/static-assets/), configured in `wrangler.jsonc`.
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) is connected to this repository:

- **Every push to `main`** builds with `npm run build:release` and deploys to production.
  The build waits briefly for the release tag so the footer can show the version.
- **Every other branch** gets its own preview URL, posted as a comment on the PR.

Merging to `main` also runs **Auto-release**, which reads the `version:major/minor/patch` label from the merged PR and creates a new semver tag and release.
PRs require exactly one version label (`version:major`, `version:minor`, or `version:patch`) before merging.

No Cloudflare credentials live in this repository or its GitHub secrets.
The hostname is attached to the Worker outside this repo, so `wrangler.jsonc` deploys unchanged to any account.

---

## Deploy your own

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jglopez/bill-split)

The button copies the repo to your GitHub account and sets up Workers Builds for it.
Or, from a clone:

```bash
npx wrangler login
npm run deploy     # build, then upload to your account's workers.dev subdomain
```

To use your own domain, add it to the Worker under **Settings → Domains & Routes** in the Cloudflare dashboard, or add a `routes` entry with `custom_domain: true` to `wrangler.jsonc`.

To host it anywhere else, serve `dist/` from any static host with unknown paths falling back to `index.html`, or use the Docker `prod` image above.
Set `BASE_PATH` at build time to serve it from a subpath (for example `BASE_PATH=/bill-split/`).

---

## Contributing

1. Branch from `main`
2. Apply a version label to your PR before merging
3. Check the preview URL Cloudflare posts on the PR
4. The deploy and release run automatically on merge

See `AGENTS.md` for notes relevant to AI assistants working on this codebase.
