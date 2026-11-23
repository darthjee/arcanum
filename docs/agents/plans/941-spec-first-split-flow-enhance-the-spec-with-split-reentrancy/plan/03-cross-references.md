# Add cross-references in the touched parts

Where reentrancy touches an existing part, add a **one-line** cross-reference to [reentrancy.md](reentrancy.md) instead of duplicating its text. Keep each edit minimal.

- **`ordering.md`**, Flow A edges: replace the sentence "The reentrancy details are an open point (#941)." with a pointer to `reentrancy.md` (e.g. "How and when it creates these links, and how failures are reported, is defined in [reentrancy.md](reentrancy.md)."). Keep the edge itself ("adds each one as a blocker of the fold issue"). Optionally note that the inter-implementation-issue order is confirmed in the reentrant split's dialogue.
- **`pointer.md`**: add one line, e.g. under Placement or a short `## Inheritance` note: a normal split of a spec-carrying parent copies the parent's pointer line verbatim to the canonical spot of every sub-issue. Link `reentrancy.md` for the mode trigger.
- **`resolver.md`**: add one line saying the spec-driven split is also a resolver consumer and reads the hub, parts and fold map only on `ready`. Link `reentrancy.md` for its gate (which also requires hub `Status: Ready`).
- **`dialogue.md`**: add one line saying the spec-driven split reuses this dialogue on `not_ready`, and that choosing "proceed without the spec" there drops to a normal split. Link `reentrancy.md`. Do not add the split to the "Covered skills" list under Automation behaviour, which is about automated skills only.
- **`guard.md`**: fix the contradiction. "Not covered" currently says `arcanum-split-issue` only creates bodies. Amend it: in spec-driven mode the split also updates the implementation-split issue's existing body (the `## Coverage` table, the `#NNN` replacement, and the "add the pointer" option), and those updates go through the guard. Link `reentrancy.md`. The best fit is a one-line bullet under "Covered skills", or a qualifier on the "Not covered" bullet.

Don't edit `flows.md`, `fold.md`, `migration.md` or `acceptance.md`, unless a link check in plan.md's CI Checks finds a stale `#941` open-point reference there. The grep in the investigation found none.

## Files to Change

- `docs/agents/specs/spec-first-split-flow/ordering.md` — swap the #941 open-point sentence for a link to `reentrancy.md`.
- `docs/agents/specs/spec-first-split-flow/pointer.md` — one line on pointer inheritance by sub-issues of a normal split.
- `docs/agents/specs/spec-first-split-flow/resolver.md` — one line naming the spec-driven split as a consumer gated on `ready`.
- `docs/agents/specs/spec-first-split-flow/dialogue.md` — one line on reuse of the dialogue, and that "proceed without" means a normal split.
- `docs/agents/specs/spec-first-split-flow/guard.md` — reconcile the split's "not covered" status with the coverage-table body updates.
