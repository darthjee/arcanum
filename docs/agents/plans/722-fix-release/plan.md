# Plan: Fix release

Issue: [722-fix-release.md](../../issues/722-fix-release.md)

## Overview

The release is red because `core/spec/bin/migrationsNextStepAuto_spec.js` hardcodes `arcanum/migrations/repos/next`, and `scripts/bump-version.sh` (#721) moved those migrations into `repos/2.0.0/`. This plan does four things: repoints the spec (`node`); teaches `bump-version.sh` to abort on stale `repos/next/NNN` references and to rewrite references to the files it moves, with a regression test (`scripter`); and fixes the existing stale doc references and documents the conventions that make the rewrite work (`architect`). Everything ships in one PR.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)
- [architect](architect.md)

## Shared contracts

**Reference pattern.** A "migration reference" is the literal text `repos/next/NNN`, where `NNN` is exactly three digits followed by a non-digit or end of line. In practice the next character is `.` (as in `NNN.sh`, `NNN.md`, `NNN.instructions.md`), a quote, a backtick, whitespace, or punctuation. As an ERE: `repos/next/[0-9]{3}([^0-9]|$)`. The rewrite replaces `repos/next/NNN` with `repos/<new-version>/NNN` and leaves the rest of the text as is.

**Scope** (the same for the guard and the rewrite):
- included: `core/spec/**`, `docs/**`, `README.md` (all relative to the repo root)
- excluded: `docs/agents/issues/**`, `docs/agents/plans/**`
- never scanned: `scripts/`, `arcanum/`, `core/node_modules/`

**Guard semantics.** A reference to `NNN` is *stale* when `arcanum/migrations/repos/next/` contains no file named `NNN.*`. `bump-version.sh` checks this **before writing anything** (before `arcanum.version` is touched). On any stale reference it prints one `<path>:<line>: <match>` line per hit to stderr and exits `1`.

**Rewrite semantics.** The rewrite runs only when `next/` is actually moved, i.e. the existing non-empty branch. It touches only references whose `NNN` belongs to a moved file. Because the guard has already passed, that means every in-scope reference.

**Spec convention** (used by `node`, documented by `architect`). A spec that exercises migration files names each file with **one string literal containing the full relative path**, e.g. `path.join(REPO_ROOT, 'arcanum/migrations/repos/2.0.0/001.sh')`. It never assembles `'repos', '<folder>'` and then appends `${id}.sh`.

**Doc convention** (documented by `architect`). Docs that refer to a pending migration cite the specific file (`arcanum/migrations/repos/next/001.sh`), never just the `next/` folder.

**Ordering inside the PR.** The `architect` doc fixes must remove every stale `repos/next/NNN` reference in scope. Otherwise the next real `bump-version.sh` run aborts on the new guard. On this branch `next/` is empty (`[]`), so after this PR, **no** in-scope `repos/next/NNN` reference may remain.
