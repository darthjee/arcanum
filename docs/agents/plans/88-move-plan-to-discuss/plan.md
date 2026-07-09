# Plan: Move Plan To Discuss

Issue: [88-move-plan-to-discuss.md](../issues/88-move-plan-to-discuss.md)

## Overview

Give `discuss-issue` the ability to kick off planning immediately after the issue is confirmed and pushed, carrying discussion context forward onto a committed branch instead of it being lost/re-derived later. Convert both of `discuss-issue`'s natural-language confirmations into script-driven yes/no checks. Make branch bootstrapping in `auto-fix-all` (and merging in `auto-fix-issue`) reuse-and-merge instead of destructively recreating, so a branch already prepared by `discuss-issue` (or any earlier stage) survives into implementation, always brought up to date with `main` first.

## Context

- `discuss-issue` today only rewrites/pushes the GitHub issue body; it never touches a git branch. Planning is always a separate, later invocation (`/plan-issue` or `/auto-plan-issue`) that re-derives context from scratch.
- `auto-fix-all/scripts/checkout_from_main.sh` unconditionally deletes and recreates `issue-<id>` from `main`, which would destroy any branch state an earlier stage (like the one this issue adds to `discuss-issue`) already prepared.
- `discuss-issue`'s two natural-language confirmations ("Did I comprehend the issue?", and the issue also asks for a new second one about planning) currently rely on free-form recognition of words like "yes"/"sim"/"correct" rather than a deterministic script.

## Implementation Steps

### Step 1 — Shared branch-merge helper (`_lib/git_branch.sh`)

New sourced-only library (not directly executable) exposing two functions:

- `git_branch_fetch_main()` — runs `git fetch origin main`, tolerating a missing remote ref exactly the way `checkout_from_main.sh` already tolerates it today (a "couldn't find remote ref"/"not found"/"no such ref" style stderr is not a hard error; anything else is).
- `git_branch_merge_main()` — calls `git_branch_fetch_main`, then, only if `refs/remotes/origin/main` exists, runs `git merge --no-edit origin/main` on the currently checked-out branch.
  - Returns 0 when there was nothing to merge (no `origin/main` ref) or the merge completed cleanly.
  - On a real conflict, does **not** abort the merge — it leaves the conflict markers in the working tree, prints each conflicted path (via `git diff --name-only --diff-filter=U`) one per line on stdout, and returns 2, so callers can react.

This is pure deterministic git plumbing — implement it as `scripter` work.

### Step 2 — Rewrite `auto-fix-all/scripts/checkout_from_main.sh`

Stop unconditionally deleting `issue-<id>`. New behavior, usage unchanged (`checkout_from_main.sh <id>`):

1. Source `_lib/git_branch.sh`.
2. `git_branch_fetch_main`, and also `git fetch origin "issue-<id>"` (tolerating a missing ref the same way).
3. If `issue-<id>` exists locally or as `origin/issue-<id>`: check it out (creating a local branch tracking `origin/issue-<id>` first, if it only exists remotely), then call `git_branch_merge_main`.
4. If it doesn't exist at all (neither local nor remote): create it fresh from `origin/main` (fall back to local `main` if there's no `origin/main` ref) — same fresh-branch outcome as today, just without an upfront forced delete.
5. Print `BRANCH=<name>` then `STATUS=ok` or `STATUS=conflict`; on conflict, also print the conflicted-file list from `git_branch_merge_main` (one path per line). Exit 0 on `ok`, exit 2 on `conflict`.

Update the script's header comment: it no longer always discards `issue-<id>`; it reuses and merges an existing branch up to date with `origin/main` instead, only creating fresh when the branch truly doesn't exist yet.

### Step 3 — New `auto-fix-issue/scripts/merge_main.sh`

Thin wrapper: source `_lib/git_branch.sh`, call `git_branch_merge_main`, print `STATUS=ok`/`STATUS=conflict` (+ conflicted-file list on conflict), exit 0/2 to match. Assumes the target issue branch is already checked out (it just brings it up to date with `main`) — used right before any specialist agent is dispatched.

### Step 4 — New `discuss-issue/scripts/confirm.sh`

Usage: `confirm.sh "<free-form reply>"`. Deterministically normalizes a free-form yes/no-ish reply to a boolean, the same exit-code-only contract already used by `has_shipit_tag.sh`/`has-shipit-label` (no stdout needed): exit 0 for an affirmative match (e.g. `yes`, `y`, `sim`, `correct`, `looks good`, `sure`, `ok`/`okay`, case-insensitive), exit 1 for everything else (including explicit negatives like `no`/`n`/`não`/`nao`/`nope` — since the agent only calls this right after asking a plain yes/no question, "not recognized as affirmative" already means "no" for this contract).

Align the exact affirmative word list with `scripter` before implementation; keep it easy to extend.

### Step 5 — `discuss-issue/steps/discuss_and_save.md`: script-driven confirmations + continue into planning

- Replace step 7 ("Comprehension loop") with a strict script-driven gate: after summarizing understanding and asking "Did I comprehend the issue?", pass the user's raw reply to `../scripts/confirm.sh`.
  - Exit 1 (no) → go back to step 4 (no push, no planning) — same as today's "no/corrections" branch.
  - Exit 0 (yes) → proceed to "Push to GitHub" (rename of today's "Update GitHub issue" section; content unchanged), then to the new step 8 below.
  - Intentionally drop the old "explicit end"/"partial or unclear" nuance branches — the issue calls for a strict, deterministic yes/no gate here, not free-form judgment.
- Add step 8 ("Planning confirmation"), asked only right after a successful push: ask "Would you like me to start planning this issue now?", pass the raw reply to `../scripts/confirm.sh` again.
  - Exit 1 (no): finish exactly as today — issue pushed to GitHub, no branch/plan created.
  - Exit 0 (yes):
    1. Run `../../auto-fix-all/scripts/checkout_from_main.sh <id>` — cross-skill reference (resolved relative to this file's directory), the same reuse-and-merge script `auto-fix-all` uses (Step 2 above). Parse `STATUS`.
       - `STATUS=conflict`: apply the same responsible-agent-selection approach as `auto-fix-all/steps/handle_comment.md`'s "Choosing the responsible agent(s)" section, treating each conflicted path like a failed check-run name — dispatch the responsible specialist(s) (or resolve it yourself, as architect, if none seem responsible) to fix the conflict, then `git add` the resolved paths and `git commit` with no message argument (the prepared merge-commit message from `git merge --no-edit` is reused). No user interaction.
       - `STATUS=ok`: continue directly.
    2. Run `../../auto-new-issue/scripts/commit_issue.sh <issue_file> <id> "<AI model name>" "<AI model email>"` — cross-skill reference to the same script `auto-new-issue` uses; commits the already-drafted issue file into this branch and pushes it.
    3. As the architect, read [../../auto-plan-issue/steps/run.md](../../auto-plan-issue/steps/run.md) and follow all its steps for `<id>` directly — no separate `Agent(architect)` spawn, per this repo's existing convention for nested skill invocation (see `docs/agents/architecture.md`'s "Architect Delegation"). Its own Step 5 commits the plan locally but does not push.
    4. Run `git push` (pushes the plan commit too) — a single command, no script needed.
    5. Report that the issue and plan are committed and pushed, and stop. Do not continue into `auto-fix-issue` in this run.

### Step 6 — `auto-fix-issue/steps/run.md`: merge `main` before dispatching agents

Insert a new sub-step into Step 2 ("Create the branch"), right after `create_branch.sh` returns and before recording `step branch_created`:

```bash
scripts/merge_main.sh
```

> Resolve `scripts/merge_main.sh` relative to the `auto-fix-issue` skill folder.

- `STATUS=ok`: record `step branch_created` as today and continue to Step 3.
- `STATUS=conflict`: same responsible-agent-selection-and-commit handling described in Step 5 above (reference `auto-fix-all/steps/handle_comment.md`'s "Choosing the responsible agent(s)" section, applied to the conflicted paths instead of comments/check-runs), then record `step branch_created` and continue.

### Step 7 — `auto-fix-all/steps/process_one_issue.md`: update Step 1's description

Reword Step 1's prose: `checkout_from_main.sh` no longer always discards `issue-<id>` — it fetches, reuses an existing branch (local or remote) merged up to date with `origin/main`, and only creates fresh when the branch doesn't exist at all. On `STATUS=conflict`, apply the same responsible-agent-selection approach as `handle_comment.md`'s "Choosing the responsible agent(s)" section (treating each conflicted path like a failed check-run name) to resolve and commit before continuing to Step 2.

### Step 8 — `auto-fix-all/SKILL.md`: force a clean branch on "Reimplement"

The "closed PR" reimplement path currently just loops back to Step 2, relying on `checkout_from_main.sh` to reset to a clean branch — that assumption breaks now that the script reuses instead of discarding. "Reimplement from scratch" is an explicit user decision to discard the rejected branch (unlike the routine bootstrap case this issue is otherwise about), so add an explicit cleanup call before looping back:

```bash
scripts/github.sh cleanup-branch <id>
```

(already exists — deletes the remote+local `issue-<id>` branch and switches back to `main`), run right before "go back to Step 2", so the next `checkout_from_main.sh` call finds no existing branch and creates a genuinely fresh one from `origin/main`, matching the user's stated intent.

### Step 9 — Documentation

- `docs/agents/architecture.md`:
  - Document the new `_lib/git_branch.sh` helper and its two functions, alongside the other `_lib/*.sh` helpers already described there.
  - Note that the "Choosing the responsible agent(s)" pattern (today described only for PR comments/CI failures) now also applies to branch-merge conflicts raised by `checkout_from_main.sh` and `auto-fix-issue/scripts/merge_main.sh`.
  - Note that `discuss-issue` can now continue straight into `auto-plan-issue` on user confirmation, reusing `auto-fix-all`'s and `auto-new-issue`'s scripts across skill boundaries — the same established cross-skill-reference pattern already used by `auto-fix-all`/`handle_comment.md` (which calls `auto-plan-issue/scripts/list_agents.sh`) and by `process_one_issue.md` (which reads `auto-new-issue`/`auto-plan-issue`/`auto-fix-issue`'s `steps/run.md` directly).
- `AGENTS.md`: no scope changes — no agents added or changed by this issue.

## Files to Change

- `_lib/git_branch.sh` — new: `git_branch_fetch_main`, `git_branch_merge_main`.
- `auto-fix-all/scripts/checkout_from_main.sh` — rewrite: reuse-and-merge instead of delete-and-recreate.
- `auto-fix-issue/scripts/merge_main.sh` — new: brings the already-checked-out issue branch up to date with `main`.
- `discuss-issue/scripts/confirm.sh` — new: deterministic yes/no normalizer.
- `discuss-issue/steps/discuss_and_save.md` — script-driven confirmations; new planning-confirmation step (bootstrap branch, commit+push issue file, run `auto-plan-issue/steps/run.md` directly, push again).
- `auto-fix-issue/steps/run.md` — Step 2 gains a `merge_main.sh` call + conflict handling before recording `branch_created`.
- `auto-fix-all/steps/process_one_issue.md` — reworded Step 1 description + conflict-handling note.
- `auto-fix-all/SKILL.md` — "closed" reimplement path calls `cleanup-branch` before looping back to Step 2.
- `docs/agents/architecture.md` — document the new helper and the extended conflict-handling pattern.

## Notes

- No CI workflow config exists in this repo (`.github/workflows` is absent), so there is no `## CI Checks` section — verification is local: exercise the new/changed scripts directly (fresh branch, existing-branch-no-conflict, existing-branch-with-conflict) and re-read every edited `.md` step for consistency with the new call sequence.
- `skill-reviewer`'s scope (PR review) has no proactive "work" for this issue — it reviews the resulting PR after the fact, per the normal pipeline, rather than being a dispatched plan participant.
- `discuss-issue`'s manual confirmation UX becomes stricter (plain yes/no via script) — the old "explicit end"/"tell me more" nuance branches from step 7 are intentionally dropped, per the issue's explicit ask for a deterministic gate.
