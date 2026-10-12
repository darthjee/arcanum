# Issue: Decide docker handling for scripts not routed through engine_dispatch

## Description

Part of epic #724 (implement `engine.mode=docker`). Surfaced while enhancing #725 (docker spec index + checklist).

Not every script under `<skill>/scripts/` and `arcanum/_lib/` goes through `arcanum/_lib/engine_dispatch.sh`, so the docker execution path does not automatically cover them. The last section of `docs/agents/specs/docker/checklist.md` ("Not routed through dispatch (pending #733)") lists 39 such files, all with `kind` = `TBD (#733)`.

**Blocks #731** (promote docker engine design into architecture docs), as decided in #751. Order: #733 → #731 → #732.

## Problem

The docker spec does not say what happens to these scripts under `engine.mode=docker`. Every row in the checklist's last section has a placeholder kind, so #731 cannot promote the spec.

Checking the snapshot in the original issue against the code turned up these corrections:

- **Sourced libraries** (never invoked directly): `arcanum/_lib/{agent_email,commit_template,config_chain,git_branch,global_config,lock,origin,repo_config,repo_path,safe_branch,tag_actions,tag_mutate,tags}.sh`, `arcanum-update/scripts/run_update_common.sh`, `auto-fix-all/scripts/{config,queue}_common.sh` and `monitor-issues/scripts/{config,rewrite_queue}_common.sh`. **`push.sh` and `merge_body.sh` are sourced libraries too.** The original snapshot listed them as entrypoints.
- **Thin per-skill wrappers**: each one is a one-line `exec` into a dispatched `arcanum/_lib` shim. They are `*/scripts/github.sh` → `github_issue.sh`, `*/scripts/list_agents.sh` → `list_agents.sh`, `*/scripts/resolve_plan_paths.sh`, `*/scripts/resolve_id_and_file.sh`, `discuss-issue/scripts/resolve_and_fetch.sh` and `auto-fix-issue/scripts/issue_state.sh`, each going to the `_lib` shim of the same name. All the targets were checked and all call `engine_dispatch`.
- **Non-dispatched entrypoints**: only two. `arcanum/_lib/next_step_prompt.sh` is pure bash. It reads `config_chain.sh` (which needs `jq`) and owns `/dev/tty`. `auto-plan-issue/scripts/auto_next.sh` is a real script, **not a wrapper as the original snapshot said**. It runs `next_step_prompt.sh --no-prompt` and then `git -C <repo> push`.
- **Install/update bootstraps**: `arcanum/install/{bootstrap,installer}.sh` and `arcanum/update/{bootstrap,updater}.sh`. They run before an arcanum install exists, or outside it.

## Expected Behavior

- Every row in the checklist's "Not routed through dispatch" section has a real `kind` and a final `status` (`n/a`). No `TBD (#733)` remains anywhere in `docs/agents/specs/docker/`.
- The `kind` column definition in the checklist's Columns table lists the new values, and says which kinds can ever be ✅ (only `dispatched` and `native-only`).
- The docker spec (`dispatch.md`, including its TTY section's "stay with #733" line, and the `docker.md` status paragraph) records the per-kind decision.
- The implementation work this decision implies is tracked in #760, a sub-issue of #724. #733 itself needs no code change.

## Solution

Decisions, per kind:

| kind | Under `engine.mode=docker` | Can be ✅ |
| --- | --- | --- |
| `sourced` | `n/a`: it runs only inside whatever sources it. Inside the container the native implementation runs, so these shell libraries are never used there. | never |
| `wrapper` | `n/a`: it is covered by the dispatched `_lib` row it `exec`s into. The `notes` column names that command. | never |
| `entrypoint` (`next_step_prompt.sh`, `auto_next.sh`) | `n/a` for now: bash on the host. Decided: they will become dispatched native commands with `migration-status.json` value `"host-only"` (#760). When that lands, their rows move into their skill-folder tables. | never, because they are `host-only` |
| `bootstrap` (install/update) | `n/a`: it runs before or outside an installed arcanum, so it can never be dispatched. | never |

`next_step_prompt.sh` must keep a real `/dev/tty` prompt. Moving it into the container would turn every next-step offer into the `AskUserQuestion` fallback. So it becomes dispatched and `host-only`, not docker: it runs native on the host, which also removes the host's bash/`jq` dependency for it. `auto_next.sh` goes with it, because it wraps `next_step_prompt.sh` and pushes with the host's git credentials. The migration itself is follow-up #760, a sub-issue of #724. This issue only records the decision.

In the checklist, `kind` gains four values for the last section: `sourced`, `wrapper`, `entrypoint` and `bootstrap`. Every `wrapper` row names the dispatch command it `exec`s into in `notes`. No row is dropped.

This is a documentation-only change (checklist and docker spec). It is owned by architect, with scripter consulted.

## Benefits

- It closes the last open Phase 1 decision of #724 and unblocks #731/#732.
- Every checklist row ends up with a final kind, so "docker done" becomes well defined: every row is ✅ or `n/a`.
