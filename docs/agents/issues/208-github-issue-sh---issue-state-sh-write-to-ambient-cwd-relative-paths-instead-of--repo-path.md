# Issue: github_issue.sh / issue_state.sh write to ambient-cwd-relative paths instead of $repo_path

## Description
While running `/discuss-issue` in a consuming repo (`darthjee/majora`), the Bash tool's ambient working directory was briefly the skill's own `discuss-issue/steps/` folder (rather than the target repo root) when `arcanum/_lib/resolve_and_fetch.sh` was invoked. That call chain reached `arcanum/_lib/github_issue.sh`'s `cmd_fetch` and `arcanum/_lib/issue_state.sh`, both of which write to **hardcoded relative paths** (`docs/agents/issues/`, `.claude/state/`) instead of resolving them against the `repo_path` argument they are given (or, for `issue_state.sh`, not accepting one at all).

## Problem

- `github_issue.sh`'s `cmd_fetch` (lines 53-103) and `cmd_create` (lines 136-178) both take `repo_path` as their first argument, used only to resolve the GitHub origin via `_load_origin` (which itself never changes cwd — it calls `git -C "$repo_path" remote get-url origin`). But both functions then hardcode:
  ```bash
  local issues_dir="docs/agents/issues"
  mkdir -p "$issues_dir"
  local filepath="${issues_dir}/${id}-${normalized}.md"
  printf '%s\n' "$body" > "$filepath"
  ```
  This path is relative to whatever the ambient shell cwd happens to be, not to `$repo_path`. `cmd_fetch` also calls `issue_state.sh set-json`/`set` without any `repo_path` — because `issue_state.sh` has no such parameter to receive it.
- `issue_state.sh`'s full interface (`get`/`set`/`set-json`/`append-json <id> <field> [value]`) takes no `repo_path` parameter at all; `STATE_DIR=".claude/state"` is hardcoded and always resolves against ambient cwd.
- `list_agents.sh` has a related but distinct gap: `list_agents.sh [agents_dir]` takes no `repo_path` concept either — `AGENTS_DIR` defaults to `.claude/agents` relative to ambient cwd, despite several skills' own step docs (`discuss-issue/steps/discuss_and_save.md`, `auto-plan-issue/steps/explore_codebase.md`) describing it as defaulting to `.claude/agents` *under* `$REPO_PATH` — a claim only true when ambient cwd already happens to equal `$REPO_PATH`.

In the observed run, the calling agent's Bash cwd was `~/.claude-darthjee/skills/discuss-issue/steps` (a skill-internal directory, not the target repo) at the moment `resolve_and_fetch.sh` → `github_issue.sh fetch` ran. As a result:
- The fetched issue body was written to `~/.claude-darthjee/skills/discuss-issue/steps/docs/agents/issues/<id>-....md`
- Its state JSON was written to `~/.claude-darthjee/skills/discuss-issue/steps/.claude/state/issue-<id>.json`

...instead of into the target repo's `docs/agents/issues/` and `.claude/state/`. The calling agent had to notice the mismatch (the script's own `STATUS=ok`/`FILE=...` output claimed success, but the file didn't exist at the expected repo-relative location), manually locate the misplaced files, and move them into the correct repo before continuing — nothing in the script itself catches or prevents this.

This is a latent bug in any script that receives a `repo_path` argument (specifically for resolving the GitHub origin) but still writes/reads files at hardcoded paths relative to ambient cwd rather than under `repo_path`. Any future skill/agent step that calls these scripts without cwd already pinned to the target repo root will silently write into the wrong location.

A full audit of `arcanum/_lib/*.sh` (see investigation below) found no further offenders: `config_chain.sh`, `spawn_issue.sh`, and `safe_branch.sh` also read/write relative to ambient cwd, but that is a deliberate, already-documented convention (see Solution) — each of those is only ever invoked after its caller has already entered the target repo, unlike `github_issue.sh`/`issue_state.sh`, which are called directly (e.g. from `resolve_and_fetch.sh`, which never enters the repo path itself) without that guarantee.

## Expected Behavior

`github_issue.sh` (`cmd_fetch`/`cmd_create`), `issue_state.sh`, and `list_agents.sh` should resolve their file paths against the given `repo_path`, regardless of the caller's ambient working directory — by adopting this repo's existing, documented convention for exactly this problem (see Solution) rather than a one-off fix.

## Solution

Align with the already-documented [Repo Path Threading](../architecture/repo-path-threading.md) convention — used today by `arcanum/_lib/safe_branch.sh`, `spawn_issue.sh`, and `config_chain.sh` — rather than ad-hoc path-prefixing:

- Have each script source the shared `arcanum/_lib/repo_path.sh` helper and call `repo_path_enter "$repo_path"` once, immediately after argument parsing and before the first path-touching line. `repo_path_enter` validates the path and `cd`'s into it, failing loudly instead of silently operating elsewhere.
- `github_issue.sh`: add the `repo_path_enter` call near the top of `cmd_fetch` and `cmd_create` (both already receive `repo_path` as their first argument for `_load_origin`, so no signature change needed there).
- `issue_state.sh`: add `repo_path` as a new required leading positional argument (it currently has none), call `repo_path_enter` with it, and update its usage/interface (`get`/`set`/`set-json`/`append-json`) accordingly.
- `list_agents.sh`: add `repo_path` as a new required leading positional argument (it currently has none — a distinct gap from the other two, which at least receive `repo_path` today even if they ignore it for path resolution), call `repo_path_enter` with it.

**Scope**: this issue covers only the three leaf scripts above becoming safe regardless of caller cwd. Updating every call site across other skills to actually pass `$REPO_PATH` through to these scripts' new/newly-honored parameter is tracked separately in #212, since several existing callers already work today (by already calling `repo_path_enter` earlier in the same process) and the full sweep touches many unrelated skills.

No existing automated tests exercise `github_issue.sh`, `issue_state.sh`, or `list_agents.sh` (confirmed by investigation), so this fix does not need to update any test for cwd-dependent assumptions.

## Benefits

- Skills that call these scripts become safe to run regardless of the caller's ambient Bash cwd, removing a silent-data-misplacement failure mode.
- Removes the need for callers to defensively `cd "$REPO_PATH"` before every script call as a workaround, which is easy to forget in a multi-step skill flow.
- Keeps the fix consistent with the repo's one existing, documented convention for this exact class of problem, instead of introducing a second, competing pattern.
