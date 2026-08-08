# Plan: Harden shared origin-resolution libs to stop trusting ambient shell cwd for resolving the target GitHub repo

Issue: [111-harden-shared-origin-resolution-libs-to-stop-trusting-ambient-shell-cwd-for-resolving-the-target-github-repo.md](../issues/111-harden-shared-origin-resolution-libs-to-stop-trusting-ambient-shell-cwd-for-resolving-the-target-github-repo.md)

## Overview

`_lib/origin.sh` and `_lib/github_issue.sh` currently resolve the target GitHub repo via a bare `git remote get-url origin` against whatever the shell's ambient cwd happens to be at call time. Every one of the 11 scripts that source or wrap either lib inherits this, and every one of the ~9 skills that eventually call those scripts inherits it transitively. This plan converts both libs' repo-resolution functions to take an explicit, required `<repo_path>` argument (no cwd fallback), threads that argument through all 11 dependent scripts and every markdown step that invokes them, has each skill resolve the path exactly once at the top of its flow (including passing it explicitly into any spawned subagent's prompt), and adds a regression script that proves the original failure mode is now structurally blocked.

## Context

Confirmed via code exploration (see issue): `discuss-issue/scripts/github.sh` and `enhance-issue/scripts/github.sh` are thin `exec` wrappers around the canonical `_lib/github_issue.sh`, which itself embeds its own copy of the `_load_origin`/`get_domain`/`get_repo_path` logic that also exists — nearly verbatim — in `_lib/origin.sh` (`get_repo_ref`, `get_gh_user`, `_ensure_gh_user`). Both copies read `git remote get-url origin` unconditionally, with no path argument anywhere in either file today. This duplication should be collapsed as part of this fix rather than perpetuated across two divergent copies.

Full inventory of scripts sourcing or wrapping either lib (11 total):
- `_lib/origin.sh` sourced directly by: `monitor-issues/scripts/monitor_issues.sh`, `auto-monitor-pr/scripts/monitor_pr.sh`, `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`, `auto-fix-all/scripts/github.sh`, `auto-fix-all/scripts/reply_comment.sh`, `auto-fix-all/scripts/queue.sh`, `auto-fix-all/scripts/wait_ci.sh`, `init-claude/scripts/sync_labels.sh`.
- `_lib/github_issue.sh` wrapped by: `discuss-issue/scripts/github.sh`, `enhance-issue/scripts/github.sh`, `auto-new-issue/scripts/github.sh`.

Markdown files that directly invoke one of the above scripts and will need their invocation line(s) updated to pass an explicit repo path (16 total): `auto-new-issue/steps/commit_and_sync.md`, `auto-new-issue/steps/run.md`, `monitor-issues/SKILL.md`, `discuss-issue/steps/discuss_and_save.md`, `enhance-issue/steps/publish.md`, `auto-monitor-pr/steps/run.md`, `auto-monitor-issue-pr/steps/run.md`, `auto-rewrite-issue/steps/run.md`, `auto-fix-issue/steps/open_pr.md`, `auto-fix-all/SKILL.md`, `push-issue-to-queue/SKILL.md`, `auto-fix-all/steps/handle_comment.md`, `auto-fix-all/steps/process_one_issue.md`, `init-claude/setup_labels.md`, and (for the `fetch`/`update`/`mark-*`/`create` commands specifically) `discuss-issue/steps/extract_id_and_name.md` and `enhance-issue/steps/fetch.md` via `resolve_and_fetch.sh`.

SKILL.md files that spawn a subagent (`Agent(subagent_type: "architect", ...)`) and will need the resolved repo path added to the spawned prompt, per `docs/agents/architecture.md`'s "Architect Delegation" convention (7 total): `auto-new-issue/SKILL.md`, `auto-plan-issue/SKILL.md`, `auto-monitor-pr/SKILL.md`, `auto-monitor-issue-pr/SKILL.md`, `auto-rewrite-issue/SKILL.md`, `auto-fix-issue/SKILL.md`, `auto-fix-all/SKILL.md`.

Skills that run entirely inline as the architect (no subagent spawn) and only need to resolve the path once at their own Step 1 and thread it through their own step chain: `discuss-issue`, `enhance-issue`, `monitor-issues`, `init-claude`, `push-issue-to-queue`.

`plan-issue` and `auto-plan-issue`'s own steps do not call either lib directly (only `auto-plan-issue`'s `SKILL.md` spawn line is relevant, for delegation purposes) — no further changes needed there beyond the spawn-prompt threading already listed above.

No CI config exists in this repo (`.github/workflows/`, `.circleci/` both absent) — verification is manual/script-based only, per the issue's decided testing strategy.

## Implementation Steps

### Step 1 — Collapse and redesign the two shared libs

Merge the duplicated origin-resolution logic into a single implementation, moved to `_lib/origin.sh` (the more generically-named file), and have `_lib/github_issue.sh` source it instead of embedding its own copy.

Redesign the resolution function to take the repo path as a required argument instead of reading ambient cwd:

```bash
# was: git remote get-url origin
# now: git -C "$repo_path" remote get-url origin
_load_origin() {
  local repo_path="${1:?_load_origin requires a repo path argument}"
  [[ "$_ORIGIN_PARSED" -eq 1 && "$_ORIGIN_REPO_PATH_KEY" == "$repo_path" ]] && return 0
  local origin
  origin=$(git -C "$repo_path" remote get-url origin 2>/dev/null) || {
    echo "Error: '$repo_path' is not a git repository or has no 'origin' remote" >&2
    exit 1
  }
  # ...same git@/https parsing as today...
  _ORIGIN_REPO_PATH_KEY="$repo_path"
  _ORIGIN_PARSED=1
}

get_repo_ref() {
  local repo_path="${1:?get_repo_ref requires a repo path argument}"
  _load_origin "$repo_path"
  # ...unchanged domain/path formatting...
}
```

Apply the same required-first-argument treatment to `get_domain`/`get_repo_path` (from the old `github_issue.sh` copy) so both libs expose one consistent calling convention: every public function's first argument is `repo_path`. `get_gh_user`/`_ensure_gh_user` are unaffected (they read git config, not `origin`, and are not the source of this bug) — leave them as-is.

Update every `cmd_*` function in `_lib/github_issue.sh` (`cmd_fetch`, `cmd_update`, `cmd_create`, `cmd_info`, `cmd_mark_refined`, `cmd_mark_created`, `cmd_mark_ready`) to take `repo_path` as their first positional argument, shifted in before their existing arguments, and to pass it to `_load_origin`/`get_domain`/`get_repo_path`. Update the top-of-file usage comment accordingly (every command's signature gains a leading `<repo_path>`).

### Step 2 — Update the 8 scripts sourcing `_lib/origin.sh` directly

For each of `monitor-issues/scripts/monitor_issues.sh`, `auto-monitor-pr/scripts/monitor_pr.sh`, `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`, `auto-fix-all/scripts/github.sh`, `auto-fix-all/scripts/reply_comment.sh`, `auto-fix-all/scripts/queue.sh`, `auto-fix-all/scripts/wait_ci.sh`, `init-claude/scripts/sync_labels.sh`:

- Add `<repo_path>` as a new required leading CLI argument (update each file's own usage comment/`Usage:` line).
- Pass it straight through to every `get_repo_ref`/`_ensure_gh_user`-adjacent call already in the file.
- Where the script itself is invoked by another script in this same list (none currently are, based on the inventory above — confirm during implementation) or where it does its own `cd`/subshell work, make sure `repo_path` survives that unaffected.

`auto-fix-all/scripts/queue.sh` is a special case: only its `save`/`push` code paths call `_mark_enqueued` (which needs `get_repo_ref`), so only those two commands strictly need `repo_path`; for consistency and to avoid a script with some commands taking the argument and others not, require it uniformly for all commands (`next`, `wait-next`, `pop`, `empty`, `list` simply ignore it).

### Step 3 — Update the 3 `github.sh` wrappers and their `resolve_and_fetch.sh`/`commit_issue.sh` callers

`discuss-issue/scripts/github.sh`, `enhance-issue/scripts/github.sh`, `auto-new-issue/scripts/github.sh` are `exec "${SCRIPT_DIR}/../../_lib/github_issue.sh" "$@"` — no change needed to the wrapper files themselves since they pass all arguments through as-is; the leading `<repo_path>` simply becomes part of `"$@"`. Verify `discuss-issue/scripts/resolve_and_fetch.sh` (used by both `discuss-issue` and `enhance-issue`) and `auto-new-issue/scripts/commit_issue.sh`/its own fetch path — if either internally calls `github.sh fetch <id>` without a repo path today, add one, taking it as their own new leading argument from their caller.

### Step 4 — Update the 16 markdown files invoking these scripts directly

For each markdown file listed under "Context" above, update the `Usage:`/example invocation line(s) to show the new leading `<repo_path>` (or `$REPO_PATH`, matching whatever variable name Step 5 establishes) argument, and update any prose that currently claims "resolves the GitHub domain and repository from `git remote get-url origin`, so no manual argument is needed" (e.g. `discuss-issue/steps/discuss_and_save.md`, `enhance-issue/steps/publish.md`) to instead describe the explicit-argument convention.

### Step 5 — Resolve `REPO_PATH` once per skill run and thread it through

For the 5 skills that run entirely inline as the architect (`discuss-issue`, `enhance-issue`, `monitor-issues`, `init-claude`, `push-issue-to-queue`): add an explicit first step (or fold into the existing Step 1) that captures `REPO_PATH="$(pwd)"` — the one moment cwd can be trusted, right at skill entry, before any other bash call — and pass `"$REPO_PATH"` as the leading argument to every subsequent script invocation in that skill's own step chain.

For the 7 skills using the coordinator/architect-subagent split (`auto-new-issue`, `auto-plan-issue`, `auto-monitor-pr`, `auto-monitor-issue-pr`, `auto-rewrite-issue`, `auto-fix-issue`, `auto-fix-all`): the thin coordinator-layer `SKILL.md` resolves `REPO_PATH="$(pwd)"` before spawning, and includes it explicitly in the `Agent(architect, prompt: "...")` text, e.g.:

```
Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `<skill-name>` skill folder) and follow it. ARGUMENTS: <raw skill arguments> REPO_PATH: <resolved_path>")
```

The corresponding `steps/run.md` (architect layer) picks `REPO_PATH` up from the prompt and threads it through every script call and cross-skill `steps/run.md` read it performs for the rest of that run — including any further nested `Agent(architect, ...)` spawns it makes itself (e.g. `auto-fix-all` spawning one architect per issue, `auto-fix-all/steps/process_one_issue.md` reading `auto-new-issue`/`auto-plan-issue`/`auto-fix-issue`'s `steps/run.md` directly per the existing "Architect Delegation"/"Cross-Skill References" convention) — `REPO_PATH` must be carried into those nested reads/spawns too, not re-resolved.

Update `docs/agents/architecture.md`'s "Architect Delegation" and "Cross-Skill References" sections to document that `REPO_PATH` (or whatever final name is chosen) is now part of what gets threaded through a spawned prompt / a directly-read nested `steps/run.md`, alongside the issue id and other arguments already described there.

### Step 6 — Add a regression script

Add a standalone script (suggested location: `_lib/test_origin_resolution.sh`, or a new `_lib/tests/` dir if that reads cleaner once Step 1's file layout is settled) that:
1. Picks two distinct git checkouts with different `origin` remotes — this repo itself (`arcanum`) plus a throwaway repo created in a temp dir (`git init` + `git remote add origin <fake-url>`) to avoid depending on any other real project being present.
2. `cd`s the shell into the throwaway repo (simulating the exact incident: cwd drifted somewhere unrelated).
3. Calls the resolver with the *arcanum* repo path passed explicitly.
4. Asserts the resolved repo is `arcanum`'s, not the throwaway repo's cwd — failing loudly (non-zero exit, clear message) if the old ambient-cwd behavior has regressed back in.

This is scoped narrowly to this issue (proving this one bug class is closed), not a general test framework — `docs/agents/todo.md` already tracks that broader gap as a separate follow-up.

### Step 7 — Update SKILL.md docs describing the old behavior

Sweep every file touched in Steps 3–5 (plus any other skill docs found to reference the old ambient-cwd assumption during implementation, e.g. via a repo-wide `grep -rn "git remote get-url origin"` after the code changes to confirm nothing is left pointing at the old behavior in prose) and correct the description to match the new required-argument convention.

## Files to Change

- `_lib/origin.sh` — collapse both origin-resolution copies here; `_load_origin`/`get_repo_ref`/`get_domain`/`get_repo_path` all take a required `repo_path` argument; use `git -C <repo_path> remote get-url origin`.
- `_lib/github_issue.sh` — drop its embedded duplicate of `_load_origin`; source `_lib/origin.sh` instead; every `cmd_*` function gains a leading `repo_path` argument.
- `monitor-issues/scripts/monitor_issues.sh` — new leading `repo_path` CLI argument, threaded to `get_repo_ref`.
- `auto-monitor-pr/scripts/monitor_pr.sh` — new leading `repo_path` CLI argument, threaded to `get_repo_ref`.
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — new leading `repo_path` CLI argument, threaded to `get_repo_ref`.
- `auto-fix-all/scripts/github.sh` — new leading `repo_path` CLI argument, threaded to every `cmd_*` that calls `get_repo_ref`.
- `auto-fix-all/scripts/reply_comment.sh` — new leading `repo_path` CLI argument, threaded to `get_repo_ref` and to its own call into `resolve_pr_number.sh`.
- `auto-fix-all/scripts/queue.sh` — new leading `repo_path` CLI argument (required for all commands, used by `_mark_enqueued`).
- `auto-fix-all/scripts/wait_ci.sh` — new leading `repo_path` CLI argument, threaded to `get_repo_ref`.
- `init-claude/scripts/sync_labels.sh` — new leading `repo_path` CLI argument, threaded to `get_repo_ref`.
- `discuss-issue/scripts/github.sh`, `enhance-issue/scripts/github.sh`, `auto-new-issue/scripts/github.sh` — no code change expected (pass-through `exec ... "$@"`); verify during implementation.
- `discuss-issue/scripts/resolve_and_fetch.sh` — thread `repo_path` through to its `github.sh fetch` call.
- `auto-new-issue/scripts/commit_issue.sh` and any sibling fetch/create helper — thread `repo_path` through.
- `auto-new-issue/steps/commit_and_sync.md`, `auto-new-issue/steps/run.md`, `monitor-issues/SKILL.md`, `discuss-issue/steps/discuss_and_save.md`, `discuss-issue/steps/extract_id_and_name.md`, `enhance-issue/steps/publish.md`, `enhance-issue/steps/fetch.md`, `auto-monitor-pr/steps/run.md`, `auto-monitor-issue-pr/steps/run.md`, `auto-rewrite-issue/steps/run.md`, `auto-fix-issue/steps/open_pr.md`, `auto-fix-all/SKILL.md`, `push-issue-to-queue/SKILL.md`, `auto-fix-all/steps/handle_comment.md`, `auto-fix-all/steps/process_one_issue.md`, `init-claude/setup_labels.md` — update script invocation lines to pass `$REPO_PATH`; correct any prose describing the old ambient-cwd resolution.
- `auto-new-issue/SKILL.md`, `auto-plan-issue/SKILL.md`, `auto-monitor-pr/SKILL.md`, `auto-monitor-issue-pr/SKILL.md`, `auto-rewrite-issue/SKILL.md`, `auto-fix-issue/SKILL.md`, `auto-fix-all/SKILL.md` — resolve `REPO_PATH` before spawning; include it in the `Agent(architect, prompt: "...")` text.
- `_lib/test_origin_resolution.sh` (new) — regression script per Step 6.
- `docs/agents/architecture.md` — document the new `REPO_PATH`-threading convention in "Architect Delegation" and "Cross-Skill References".

## Notes

- This touches ~30 files across nearly every skill in the repo — high mechanical-change volume, low conceptual risk per file (each change is the same shape: add a leading required argument, thread it through). Recommend the implementing agent do `_lib/origin.sh` + `_lib/github_issue.sh` + one full skill end-to-end first (e.g. `discuss-issue`, since it's the skill from the original incident) to shake out the exact argument-threading pattern and script conventions, then mechanically repeat it across the rest.
- Decided in discussion (see issue): required positional argument, no `--repo-path` flag with a cwd fallback, no env var — a missing argument must be a hard usage error, not a silent fallback.
- After code changes land, a repo-wide `grep -rn "git remote get-url origin"` should return zero hits outside `_lib/origin.sh` itself — useful as a quick self-check that no call site was missed.
- `docs/agents/todo.md` already has a note (added while discussing this issue) that this repo has no test framework for its shell scripts generally; the regression script in Step 6 is intentionally scoped to just this bug, not an attempt to address that broader gap.
