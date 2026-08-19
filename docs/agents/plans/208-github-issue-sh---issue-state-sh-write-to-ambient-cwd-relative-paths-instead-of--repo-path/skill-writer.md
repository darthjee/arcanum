# Skill-Writer Plan: github_issue.sh / issue_state.sh write to ambient-cwd-relative paths instead of $repo_path

Main plan: [plan.md](plan.md)

## Shared contracts

Update every documented call to match the new signatures scripter is implementing (see [scripter.md](scripter.md)):

- `arcanum/_lib/issue_state.sh <repo_path> <get|set|set-json|append-json> <id> <field> [value]`
- `arcanum/_lib/list_agents.sh <repo_path> [agents_dir]`

`$REPO_PATH` is already the standard threaded variable in every one of these step docs (per [Repo Path Threading](../../architecture/repo-path-threading.md)) — each edit below is purely inserting it into an existing call, not introducing a new variable.

## Implementation Steps

### Step 1 — `issue_state.sh` call sites in step docs

- `arcanum-split-issue/steps/fetch.md:28` — `../../arcanum/_lib/issue_state.sh get <id> sub-issues` → `../../arcanum/_lib/issue_state.sh "$REPO_PATH" get <id> sub-issues`.
- `auto-fix-issue/steps/run.md` — seven calls to the skill-local wrapper (`scripts/issue_state.sh get|set <id> step ...` at lines 10, 50, 79, 97, 110, 120, 130) → each becomes `scripts/issue_state.sh "$REPO_PATH" get|set <id> step ...`. Also check whether `REPO_PATH` is explicitly documented as available at each of these call points in this file already (it should be, as the skill's standard threaded variable per its own `SKILL.md`) — if any call site's surrounding prose doesn't already establish `$REPO_PATH` in scope, add a short note that it's the value threaded from the skill's own entry point.

### Step 2 — `list_agents.sh` call sites in step docs

For each, insert `"$REPO_PATH"` as the new first argument, and update the surrounding prose that currently describes the *old* zero-arg default behavior ("defaults to `.claude/agents` under `$REPO_PATH`" / "under the current project root") to instead say the script now takes `repo_path` explicitly and resolves `.claude/agents` relative to it:

- `plan-issue/steps/write_and_confirm.md:72` — `../scripts/list_agents.sh` → `../scripts/list_agents.sh "$REPO_PATH"`.
- `discuss-issue/steps/discuss_and_save.md:21` — `../scripts/list_agents.sh` → `../scripts/list_agents.sh "$REPO_PATH"`. (This is the very step doc `discuss-issue` followed to plan this issue — keep the wording change minimal and consistent with the others.)
- `auto-plan-issue/steps/explore_codebase.md:17` — `scripts/list_agents.sh` → `scripts/list_agents.sh "$REPO_PATH"`.
- `auto-plan-issue/steps/determine_agents.md:10` — bare `scripts/list_agents.sh` → `scripts/list_agents.sh "$REPO_PATH"`. Note this doc is itself read as a nested step from `explore_codebase.md`/other skills reusing its heuristic (e.g. `discuss-issue/steps/discuss_and_save.md` step 3 references it) — check callers of *this file* aren't relying on the old bare-call example verbatim elsewhere before/after editing.
- `auto-fix-all/steps/handle_comment.md:10` — `../auto-plan-issue/scripts/list_agents.sh` → `../auto-plan-issue/scripts/list_agents.sh "$REPO_PATH"`.

### Step 3 — Sweep for stragglers

Re-run `grep -rln "list_agents\.sh\|issue_state\.sh" --include="*.md"` across the repo after Steps 1-2 and confirm every remaining match is either: (a) already updated, (b) a comment/prose reference not an actual invocation (leave as-is), or (c) a genuinely new call site scripter's Step 4/5 (in [scripter.md](scripter.md)) didn't have — flag any such case to scripter rather than resolving it unilaterally, since it may need a script-side change too.

## Files to Change

- `arcanum-split-issue/steps/fetch.md`
- `auto-fix-issue/steps/run.md`
- `plan-issue/steps/write_and_confirm.md`
- `discuss-issue/steps/discuss_and_save.md`
- `auto-plan-issue/steps/explore_codebase.md`
- `auto-plan-issue/steps/determine_agents.md`
- `auto-fix-all/steps/handle_comment.md`

## Notes

- Keep each edit minimal — this is a signature-consistency fix, not a rewrite of surrounding step-doc prose. Only touch the sentence(s) directly describing the `list_agents.sh`/`issue_state.sh` call and its default-resolution behavior.
- No CI check applies to `.md` step docs; correctness here is verified by scripter's manual run-through (Step 6 in [scripter.md](scripter.md)) actually exercising the documented call shape.
