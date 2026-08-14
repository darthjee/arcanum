# Plan: Change branch on discussion

Issue: [146-change-branch-on-discussion.md](../issues/146-change-branch-on-discussion.md)

## Overview

`enhance-issue`, `discuss-issue`, and `arcanum-split-issue` all funnel their Step 1 (resolve id + fetch issue content) through the single canonical `arcanum/_lib/resolve_and_fetch.sh`. This plan adds a new sourced lib, `arcanum/_lib/safe_branch.sh`, plus an executable CLI wrapper, `arcanum/_lib/checkout_safe_branch.sh <repo_path>`, that fetches (`git fetch -p`) and checks out a configurable "safe" branch (default `origin/main`, detached HEAD) — hard-erroring instead of proceeding if the working tree has real uncommitted changes. The opening call is wired into `resolve_and_fetch.sh` itself (covering all three skills' Step 1 in one place); the closing call is wired individually into each skill's true end point, only where that skill can actually land on `issue-<id>` in the first place. A new `"script"`-type per-repo migration seeds the `git.safe_branch` config key.

No agent split: none of this touches any `<skill-name>/scripts/` folder (`arcanum/_lib/` and `arcanum/migrations/` are shared infrastructure, not a per-skill `scripts/` dir — see `docs/agents/architecture.md`'s "Repo Path Threading"/"Branch Bootstrap and Merge Conflicts" sections for the existing precedent of this kind of change being architect-owned), so `scripter`/`skill-reviewer` have no work here.

## Context

See the issue file for the full problem statement and design decisions reached during `enhance-issue`/`discuss-issue`. Key points carried into this plan:

- Config: `.claude/state/arcanum-config.json` → `{"git": {"safe_branch": "origin/main"}}`, read/written via existing `repo_config_read`/`repo_config_write` (`arcanum/_lib/repo_config.sh`).
- Checkout lands on a **detached HEAD** on the configured ref (e.g. `origin/main`) — no local tracking branch is created or needed, since these skills never commit while parked there.
- `git fetch -p` is a plain, unscoped fetch+prune (not narrowed to a single ref), matching the issue's literal wording and incidentally clearing stale `issue-<id>` remote-tracking refs.
- Dirty-tree check is scoped to actual uncommitted **changes** on tracked files (`git diff --quiet` / `git diff --cached --quiet`), not the mere presence of untracked files.
- Migration is `"script"`-type, `applies_to: "local"` (matches migration 001's precedent — same target file, `.claude/state/arcanum-config.json`, which is gitignored/per-clone).

## Implementation Steps

### Step 1 — `arcanum/_lib/safe_branch.sh` (new, sourced-only)

Follows the same convention as `arcanum/_lib/git_branch.sh`: no `repo_path` argument on its functions — operates on the ambient cwd, which callers must have already entered via `repo_path_enter` (see "Repo Path Threading" in `docs/agents/architecture.md`). Sources `repo_config.sh`.

- `safe_branch_get()` — prints the configured branch: `repo_config_read ".claude/state/arcanum-config.json" "" "git" "safe_branch"`, strips the JSON quoting, defaults to `origin/main` when empty/absent.
- `safe_branch_checkout()`:
  1. Dirty check: if `git diff --quiet --exit-code` or `git diff --cached --quiet --exit-code` fails (i.e. there are uncommitted changes to tracked files), print a clear error to stderr and `exit 1` — do not stash/discard, do not check untracked files.
  2. `git fetch -p`.
  3. `git checkout "$(safe_branch_get)"`.
  4. Print `BRANCH=<resolved branch>` on success.

### Step 2 — `arcanum/_lib/checkout_safe_branch.sh` (new, executable CLI wrapper)

Usage: `checkout_safe_branch.sh <repo_path>`. Sources `repo_path.sh` and `safe_branch.sh`. Calls `repo_path_enter "$1"` then `safe_branch_checkout`. This is the entry point every `steps/*.md` file below calls directly (mirrors how `auto-fix-all/scripts/checkout_from_main.sh` wraps `git_branch.sh`).

### Step 3 — Wire the opening checkout into `arcanum/_lib/resolve_and_fetch.sh`

At the very top of `resolve_and_fetch.sh` (before calling `resolve_id_and_file.sh`), call `"${SCRIPT_DIR}/checkout_safe_branch.sh" "$REPO_PATH"`. Since the script already has `set -euo pipefail`, a dirty-tree failure here aborts the whole call with a nonzero exit and the lib's stderr message — distinct from, and not folded into, the existing `STATUS=ok`/`STATUS=error` output contract (that contract is specifically about "does the GitHub issue exist," not this). This single edit covers all three skills' Step 1, since `enhance-issue`'s `fetch.md` and `discuss-issue`'s `extract_id_and_name.md` both call this file indirectly (via `discuss-issue/scripts/resolve_and_fetch.sh`'s thin wrapper) and `arcanum-split-issue`'s `fetch.md` calls it directly.

### Step 4 — Closing checkout in `enhance-issue/steps/publish.md`

After the existing `github.sh update`/`mark-created` calls (and before/alongside deleting the local draft file), add:

```bash
../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
```

Document that this is a defensive no-op today (this skill never checks out `issue-<id>` itself) but keeps the working tree in the same known-safe state every one of these three skills leaves it in.

### Step 5 — Closing checkout in `discuss-issue/steps/discuss_and_save.md`

Step 8 has two exit points; add the same call to both:
- **"no" branch** ("finish exactly as today... Nothing further to do.") — add the checkout call right before that step ends. Defensive no-op (this path never touches `issue-<id>`).
- **"yes" branch** — add the call as the final action, after "Report that the issue and plan are committed and pushed, and stop," i.e. this is the one real release: it hands back the `issue-<id>` branch that `checkout_from_main.sh` put the working tree on earlier in this same step.

```bash
../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
```

### Step 6 — Closing checkout in `arcanum-split-issue/scripts/finish.sh`

This file already sources `repo_path.sh` and calls `repo_path_enter "$REPO_PATH"`. Add, at the end (after the existing delete-local-files loop): source `../../arcanum/_lib/safe_branch.sh` and call `safe_branch_checkout` directly (no need to go through the CLI wrapper here, since this is already a script with the right cwd set up) — print its `BRANCH=` line through as-is. Defensive no-op today, same as Step 4 (this skill never checks out `issue-<id>` itself either).

### Step 7 — Document the new opening behavior in each skill's Step 1 prose

Update `enhance-issue/steps/fetch.md`, `discuss-issue/steps/extract_id_and_name.md`, and `arcanum-split-issue/steps/fetch.md`'s prose (not their bash blocks — no new call needed there, per Step 3) to note that `resolve_and_fetch.sh` now also fetches and checks out the configured safe branch before resolving anything, and that a dirty working tree makes the whole call fail (surfaced to the user as a plain script error, not a `STATUS=error` case).

### Step 8 — Migration

Scaffold via `arcanum/migrations/generate_next.sh --type script` (from within `arcanum/migrations/`), producing `arcanum/migrations/repos/next/001.sh` and `001.md` and appending `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "local"}` to `repos/next/migrations.json`.

Implement `001.sh`'s `run` (the `config` subcommand is unused by manifest-driven entries but keep the standard `{"skippable": true}` stub for legacy-compatibility, matching migration 001's shape):
1. Guess the default: `git remote` → first listed name, falling back to `origin` if none configured; branch is always `main`. Default guess = `<remote>/main`.
2. Probe `/dev/tty` the same way `arcanum/migrations/update_per_file.sh` already does (`exec 3</dev/tty`, checked before attempting to read):
   - **Available** — print the guessed default, prompt `[Y]es/[T]ype/[S]kip:`.
     - `Y` → `repo_config_write ".claude/state/arcanum-config.json" "" "git" "safe_branch" "\"<guess>\""`.
     - `T` → read the typed branch from `/dev/tty`, `repo_config_write` with that value.
     - `S` → write nothing; exit 0.
   - **Unavailable** — `repo_config_write` the guessed default silently, no prompt.
3. Idempotent — safe to re-run (re-prompts or re-applies each time).

Write `001.md`'s human-facing description (shown at the outer `[R]un/[S]kip/[C]hat` entry-level prompt): explains this sets `git.safe_branch`, used by `enhance-issue`/`discuss-issue`/`arcanum-split-issue` to release `issue-<id>` branches back to a safe parking spot in shared-`.git` multi-agent workspaces.

### Step 9 — Update `docs/agents/architecture.md`

- **"Branch Bootstrap and Merge Conflicts"** (or a new adjacent section) — document `arcanum/_lib/safe_branch.sh` (`safe_branch_get`, `safe_branch_checkout`) and `arcanum/_lib/checkout_safe_branch.sh`, and list the three skills' opening (via `resolve_and_fetch.sh`) and closing integration points, same shape as the existing `checkout_from_main.sh`/`merge_main.sh` writeup in that section.
- **"Shared State & Configuration Files"** — add `git.safe_branch` to the `.claude/state/arcanum-config.json` row's key list and JSON schema example (alongside the existing `auto-fix-all`/`migrations` keys).

## Files to Change

- `arcanum/_lib/safe_branch.sh` — new, sourced lib (`safe_branch_get`, `safe_branch_checkout`).
- `arcanum/_lib/checkout_safe_branch.sh` — new, executable CLI wrapper.
- `arcanum/_lib/resolve_and_fetch.sh` — call the wrapper at the top, before resolving the issue id.
- `enhance-issue/steps/publish.md` — add closing checkout call.
- `enhance-issue/steps/fetch.md` — document the new opening behavior (prose only).
- `discuss-issue/steps/discuss_and_save.md` — add closing checkout call to both Step 8 exit points.
- `discuss-issue/steps/extract_id_and_name.md` — document the new opening behavior (prose only).
- `arcanum-split-issue/scripts/finish.sh` — add closing checkout call (source `safe_branch.sh` directly).
- `arcanum-split-issue/steps/fetch.md` — document the new opening behavior (prose only).
- `arcanum/migrations/repos/next/migrations.json` — new `"001"` script entry (via `generate_next.sh`).
- `arcanum/migrations/repos/next/001.sh` — new migration script.
- `arcanum/migrations/repos/next/001.md` — new migration description.
- `docs/agents/architecture.md` — document the new lib/wrapper and the `git.safe_branch` config key.

## Notes

- No CI job in this repo runs anything against these paths beyond the tag-triggered release build (`.circleci/config.yml`) and the non-blocking `docs/agents/tag-mutations.md` check — neither applies here, so no `## CI Checks` section.
- `git fetch -p` with no remote argument fetches/prunes git's single default remote (typically `origin`, or whatever the current branch's upstream resolves to) — this matches the issue's literal wording and is *not* the same as `git fetch --all --prune`. Worth a one-line comment in `safe_branch.sh` so a future reader doesn't "fix" it into an all-remotes fetch.
- `resolve_and_fetch.sh` gains a new failure mode (dirty tree → hard exit before any `STATUS=` line is ever printed) that isn't part of its documented `STATUS=ok`/`STATUS=error` contract. Skills calling it should treat a nonzero exit with no `STATUS=` output as this new case and surface the stderr message directly, rather than trying to force it through the existing "GitHub issue not found" retry prompt.
