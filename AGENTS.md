# AGENTS

Notes for AI assistants working on this codebase. Read the code, git history, and repo config for anything not covered here.

---

## Non-obvious design decisions

**`price` and amount fields are strings in state.** Numeric inputs fight React controlled components on every keystroke. String → float conversion happens only in `calculate.ts`, not in the hook or components.

**`assignedTo` stores participant IDs, not names.** Names change; IDs don't. Renaming a participant must not break existing item assignments.

**The last item row is always blank.** `useBillSplit` appends a blank row whenever state changes make the last row non-blank. This is the auto-grow mechanism — no "Add item" button needed.

**Tax/tip fields use `inputMode="text"`** to allow the `%` suffix. Item price and payer amount fields use `inputMode="decimal"` because they only ever hold numbers.

**`ParticipantSection` is intentionally isolated.** The participant data source is expected to change (freeform text today, user profiles after OIDC is added). Keep participant management inside that component boundary.

**Settlement uses greedy debt simplification.** See `calculateSettlement` in `calculate.ts` for the algorithm. It minimizes transaction count but doesn't guarantee a unique solution.

---

## Things to avoid

- Don't add comments that include specific config values — they drift. Describe intent instead.
- The `base` path in `vite.config.ts` is tied to the current deployment path (the repo name). If migrating to a custom domain or a host that serves from the root, remove it or drive it via an environment variable.
