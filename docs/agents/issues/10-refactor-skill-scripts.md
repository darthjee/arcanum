# Refactor skill scripts

## Context

Several skills' `.sh` scripts duplicate the same logic, and a few scripts have grown to handle more than one responsibility. This makes them harder to maintain and more error-prone to keep in sync across skills.

## What needs to be done

- **Duplicated logic**: the origin-resolution helpers (`_load_origin`, `get_repo_ref`, `get_gh_user`, `_ensure_gh_user`) are duplicated verbatim across `new-issue/scripts/github.sh`, `auto-new-issue/scripts/github.sh`, `auto-fix-issue/scripts/github.sh`, `auto-fix-all/scripts/github.sh`, `auto-fix-all/scripts/monitor_pr.sh`, and `auto-fix-all/scripts/wait_ci.sh`. This was a deliberate choice so each skill stays self-contained (no cross-skill sourcing) — evaluate whether that tradeoff still holds, or whether a shared, sourced helper file (e.g. one per skill that needs it, or a single repo-level one) would reduce duplication without breaking self-containment in a way that matters. Decide and document the chosen approach during planning, rather than assuming either direction by default.
- **Scripts with too many responsibilities**: identify scripts that mix unrelated concerns (e.g. argument/usage parsing, GitHub API calls, file writing, and text-processing all in one function) and split them into smaller, single-purpose scripts or functions where it improves clarity — without over-fragmenting trivial scripts that are already focused.

## Acceptance criteria

- [ ] A documented decision exists on how/whether origin-resolution duplication is addressed, with the chosen approach applied consistently.
- [ ] At least the most duplicated/overloaded scripts identified during planning are refactored, with no behavior change (same inputs/outputs as before).
- [ ] No skill is left broken or with mismatched copies of a script that's supposed to stay identical to another (e.g. `new-issue`/`auto-new-issue`'s `github.sh` pairs).

---
See issue for details: https://github.com/darthjee/arcanum/issues/10

---

tags: :shipit:
