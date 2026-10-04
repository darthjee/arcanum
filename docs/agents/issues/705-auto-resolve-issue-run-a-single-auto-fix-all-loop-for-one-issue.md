# Issue: auto-resolve-issue: run a single auto-fix-all loop for one issue

## Description
Add a new skill, `auto-resolve-issue` (`/auto-resolve-issue <id>`), that runs exactly one iteration of the `auto-fix-all` loop for a single issue, with no queue. It takes the issue all the way to a terminal outcome: new issue → plan → fix → PR → monitor (comments, CI fixes) → merge.

## Problem
- `auto-fix-all` runs the full pipeline, but only through a queue that runs forever.
- `auto-fix-issue` implements an already-planned issue and opens (or marks ready) the PR, then stops. Its finish report hands off to `/auto-monitor-issue-pr`.
- No skill takes **one** issue from start to merge. The per-issue pipeline already exists as `auto-fix-all/steps/process_one_issue.md`, but it can only be reached through `auto-fix-all`'s queue.

## Expected Behavior
`/auto-resolve-issue <id>` behaves like one `auto-fix-all` iteration:

1. **Epic check**: if the issue is labelled `Epic`, skip it and suggest `/arcanum-split-issue <id>` (same `has-label ... Epic` check as `auto-fix-all` Step 2).
2. **Per-issue pipeline**: a spawned `architect` runs branch bootstrap → `auto-new-issue` → `auto-plan-issue` → `auto-fix-issue` → `shipit` check → PR monitoring, comment handling, CI fixes, merge. The existing idempotent guards (branch reuse, "plan already exists", "PR already exists") let it resume an issue that is already partly done, e.g. already planned via `discuss-issue`.
3. **Single-issue coordinator** reacting to the outcome:
   - `merged`: finish with a `success` report including the PR link, with no next-step offer.
   - `pending`: reschedule itself with `ScheduleWakeup(..., prompt="/auto-resolve-issue <id>")`, same as `auto-fix-all`. This requires the skill to be invoked via `/loop /auto-resolve-issue <id>`; when it wasn't, say so clearly instead of silently doing nothing. Each wakeup spawns a fresh architect that fast-forwards through the idempotent guards to one more monitor check.
   - `closed`: ask the user to reimplement from scratch (clean up the branch, then rerun) or stop.
   - `blocked`: ask the user to retry or stop.

   There is no "skip to the next issue" option, since there is no queue. Choosing to stop ends with a `declined` report.

`auto-fix-all`'s `clear_context` setting does not apply. A single issue never needs to clear context between issues.

`auto-fix-issue` stays unchanged. It is still the building block that stops at "PR opened". It is run nested by the pipeline and offered as the next step by `plan-issue`/`discuss-issue`.

## Solution
### New skill
Create `auto-resolve-issue/SKILL.md` as the single-issue coordinator described above, modelled on `auto-fix-all/SKILL.md` Steps 2–3 without the queue.

### Refactor: single source of truth
Move the per-issue **steps** from `auto-fix-all` into `auto-resolve-issue`:
- `auto-fix-all/steps/process_one_issue.md`
- `auto-fix-all/steps/handle_comment.md`
- `auto-fix-all/templates/reply.tmpl.md`

`auto-fix-all` becomes a queue wrapper whose per-issue spawn points at `auto-resolve-issue`'s per-issue step.

**Scripts stay in `auto-fix-all`** (`github.sh`, `wait_ci.sh`, `wait_ci_and_merge.sh`, `checkout_from_main.sh`, `cleanup_artifacts.sh`, `reply_comment.sh`, and their `*_shell.sh` / Node counterparts). The moved steps call them as cross-skill references, resolved relative to the `auto-fix-all` skill folder. Reasons:
- Consumer repos allowlist `Bash(auto-fix-all/scripts/wait_ci_and_merge.sh *)` in `.claude/settings.json` (provisioned by `init-claude/setup_permissions.md` and migrations `0.16.0/001–003`). Moving the script would require a new migration, or the `shipit` path would silently start prompting again.
- The Node commands (`core/lib/commands/auto-fix-all/*`, `core/lib/core/commands.js`) and their parity specs stay untouched.

Update every cross-skill reference to the moved steps (see `docs/agents/architecture/cross-skill-references.md`), notably:
- `auto-fix-issue/steps/run.md` and `auto-fix-issue/steps/dispatch_agents.md` (point at `handle_comment.md`)
- `discuss-issue/steps/discuss_and_save.md` and `plan-issue/steps/write_and_confirm.md` (point at `handle_comment.md`)
- `auto-fix-all/SKILL.md` (spawn prompt)
- the moved steps' own relative links (`../../auto-new-issue/...`, `../../auto-plan-issue/...`, `../../auto-fix-issue/...`, `../../auto-monitor-issue-pr/...`, and `scripts/...`, which now resolve relative to `auto-fix-all`)
- docs under `docs/agents/` (`folder-structure.md`, `issue-tags.md`, `branch-bootstrap-and-merge-conflicts.md`, `skill-finish.md`, `tag-mutations.md`, …) and `README.md`

## Benefits
- One command takes a single issue from idea to merged PR without setting up a queue.
- The per-issue pipeline has one source of truth, shared by `auto-resolve-issue` and `auto-fix-all`.
- `auto-fix-issue` keeps its narrow, composable role.
