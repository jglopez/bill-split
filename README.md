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
- Drag a participant's column header in the items table to reorder people. The summary, settlement, share summary and bill links all follow that order. On narrow phone screens, drag the grip next to a name in the participant list instead
- Copy a summary of what each person owes, with a note naming what each share already includes (tax, tip, fees, and discounts, as the bill has them) and a link that opens the bill, ready to paste into a group chat. The bill's name and each person's share are bold in apps that keep formatting on paste, and plain elsewhere. The wording lives in a template, `src/share/summary/default.liquid`. A smaller button shares just the bill link through the share sheet, or copies it where there is none
- The summary ends with a link that opens the same bill in the app, ready to view or adjust. The bill travels in the link's `#` fragment, so it never reaches the server. Opening a link asks first if you already have a bill in progress
- The share icon on each person's receipt card (on phones) or under their column in the summary table (on wider screens) sends a link that opens the bill scrolled to that person's card, highlighted for a moment, with a line saying what they owe (or copies it where there's no share sheet)
- Session auto-saves to localStorage (survives page refresh)
- Fully responsive: works on Safari on iOS, Chrome for Android, and desktop. On narrow phone screens the participants become a one-per-line list, and the items table and the summary turn into stacked cards (tap an item's split line to choose who shares it, and a long item name wraps onto more lines), so nothing scrolls sideways. Each person's summary card reads like their own itemized receipt: the items they share in, who they share each one with, and their part of each, then their subtotal, tax, tip, fees, and total

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
