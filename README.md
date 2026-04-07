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
- Session auto-saves to localStorage (survives page refresh)
- Fully responsive — works on Safari on iOS, Chrome for Android, and desktop

---

## Running locally

```bash
npm install
npm run dev
```

The URL will be shown in the terminal output.

Other scripts:

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build locally
npm run typecheck  # run TypeScript without emitting files
```

---

## Deployment

Merging to `main` triggers two workflows:

1. **Deploy** — builds and publishes the site automatically.
2. **Auto-release** — reads the `version:major/minor/patch` label from the merged PR and creates a new semver tag and release.

PRs require exactly one version label (`version:major`, `version:minor`, or `version:patch`) before merging.

---

## Contributing

1. Branch from `main`
2. Apply a version label to your PR before merging
3. The deploy and release workflows run automatically on merge

See `AGENTS.md` for notes relevant to AI assistants working on this codebase.
