# AGENTS

Notes for AI assistants working on this codebase. Read the code, git history, and repo config for anything not covered here.

---

## Non-obvious design decisions

**`price` and amount fields are strings in state.** Numeric inputs fight React controlled components on every keystroke. String → float conversion for the authoritative per-person breakdown happens in `calculate.ts`. Components parse prices locally only for display hints (e.g. showing per-checkbox share amounts).

**`assignedTo` stores participant IDs, not names.** Names change; IDs don't. Renaming a participant must not break existing item assignments. `null` = all participants (sentinel that avoids updating every item when participants are added or removed); `[]` = no one assigned; `[ids]` = explicit subset.

**The last item row is always blank.** `useBillSplit` appends a blank row whenever state changes make the last row non-blank. This is the auto-grow mechanism — no "Add item" button needed.

**Tax/tip fields use `inputMode="text"`** to allow the `%` suffix. Item price and payer amount fields use `inputMode="decimal"` because they only ever hold numbers.

**`ParticipantSection` is intentionally isolated.** The participant data source is expected to change (freeform text today, user profiles after OIDC is added). Keep participant management inside that component boundary.

**Settlement uses greedy debt simplification.** See `calculateSettlement` in `calculate.ts` for the algorithm. It minimizes transaction count but doesn't guarantee a unique solution.

**The app reloads itself when a new build is deployed.** Installed web apps (iOS "Add to Home Screen") have no refresh control and can serve a cached page indefinitely. The build emits `version.json` (see `vite-plugins/version.ts`, which also supplies the build ID and version baked into the bundle); `useAutoUpdate` fetches it uncached on launch and on returning to the foreground, and reloads if the build ID differs. It reloads without asking because bill state is persisted on every change. Two guards: it stays off while saving is failing (a reload would lose in-memory state), and it records the target build in `sessionStorage` so a stale cache can't cause a reload loop. Updates are detected by commit SHA, not release tag, because the tag is created in parallel with the deploy and may not exist at build time; the tag is display-only.

**Previews say so in the footer; production doesn't.** `version.json` has `env` (`production` or `preview`). A preview build also records its `branch` and `pr` (the open pull request from that branch, looked up by `scripts/build-release.sh`, or a search for the branch's PRs when that lookup fails), and the footer shows a Preview badge with the branch linking to the PR. Production builds leave `branch` and `pr` out, and the footer stays version and build only. A build is a preview only when Workers Builds builds a branch other than `PRODUCTION_BRANCH` (default `main`); local, Docker and self-hosted builds count as production.

**Bill schema changes go through versioned, lazy-loaded migrations.** `src/lib/migrations/index.ts` owns `CURRENT_BILL_VERSION` and a registry of steps, one file per step (`vN.ts` turns vN into vN+1). Steps are dynamic imports, so their code is fetched only when old data is actually found; current data imports none of it. Saved bills are upgraded in `main.tsx` before the first render, because `useBillSplit` saves on mount and would otherwise overwrite the old bill with defaults. For the same reason, if a step's code can't be fetched, the app shows a reload prompt instead of rendering. Changing the `BillState` shape means following the checklist at the top of `index.ts`. `meta.test.ts` and `shape.test.ts` fail until the step, its tests, its registration, and a pinned fixture are all in place. Never edit existing fixtures; they stand for bills already saved (and, later, links already shared).

**Every share method goes through one path.** Getting a bill out of the app (summary text, links, exports, payment requests; see #4) uses `shareText` in `src/share/shareText.ts`, which opens the OS share sheet where there is one and copies to the clipboard otherwise, and a `ShareButton` inside `ShareSection` in the UI. A new share method adds a `ShareButton`; it doesn't build its own share or copy code. `shareText` must run synchronously from the click, because iOS only opens the share sheet during the tap, so a method prepares its content (and loads any code it needs) before the click and keeps its button disabled until then. Share data comes from one format-neutral builder in `src/share/` (added with the summary text, #150) that every method reuses; don't write a second one.

**Deploys run on Cloudflare Workers Builds, not GitHub Actions.** Pushes to `main` deploy production with `npm run build:release`; other branches get a preview URL that Cloudflare posts as a PR comment. Workers Builds sees every push, including ones made with `GITHUB_TOKEN`, so bot workflows never need to dispatch a deploy (they still dispatch auto-release, which a `GITHUB_TOKEN` push doesn't trigger).

**Working from a Claude Code cloud session.** Never deploy from a session: there are no Cloudflare credentials in it, and pushing the branch is the deploy. To check a change in the real runtime, run `npm run preview:worker` (wrangler dev on a local workerd, no login needed) and drive it with the preinstalled Playwright. Read Workers Builds status and logs through the Cloudflare MCP connector. A PR's preview URL arrives in Cloudflare's PR comment. It's on workers.dev, which the cloud environment's network may not allow; if a session can't reach it, check the change with `preview:worker` instead.

---

## Things to avoid

- Don't add comments that include specific config values — they drift. Describe intent instead.
- The `base` path in `vite.config.ts` defaults to `/` and is overridable via the `BASE_PATH` env var for subpath hosting. Don't hardcode a different default.
- Don't name the production hostname, the owner's other domains, or the owner's private repositories anywhere in this repo: code, docs, issues, PR descriptions, PR comments, commit messages or release notes. Say "outside this repo" instead. Previews use workers.dev, so the hostname never needs to appear.
- Don't add `routes`, `account_id`, or a custom domain to `wrangler.jsonc`. It stays deployable unchanged to any account; the production hostname is attached outside this repo. The MCP server (#146) belongs in this same Worker: add `main` and `assets.run_worker_first` for its path.
