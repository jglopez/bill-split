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

**Bill schema changes go through versioned, lazy-loaded migrations.** `src/lib/migrations/index.ts` owns `CURRENT_BILL_VERSION` and a registry of steps, one file per step (`vN.ts` turns vN into vN+1). Steps are dynamic imports, so their code is fetched only when old data is actually found; current data imports none of it. Saved bills are upgraded in `main.tsx` before the first render, because `useBillSplit` saves on mount and would otherwise overwrite the old bill with defaults. For the same reason, if a step's code can't be fetched, the app shows a reload prompt instead of rendering. Changing the `BillState` shape means following the checklist at the top of `index.ts`. `meta.test.ts` and `shape.test.ts` fail until the step, its tests, its registration, and a pinned fixture are all in place. Never edit existing fixtures; they stand for bills already saved (and, later, links already shared).

---

## Things to avoid

- Don't add comments that include specific config values — they drift. Describe intent instead.
- The `base` path in `vite.config.ts` defaults to `/bill-split/` (the GitHub Pages deployment path) but is overridable via the `BASE_PATH` env var. The Docker prod build sets `BASE_PATH=/`. Don't hardcode a different default.
