# Scripter Plan: Check why merge commit are keeping claude author

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the shell side of the trailer builder:

- `arcanum/_lib/agent_email.sh` gains `coauthor_trailers <agent> <model_name> <model_email>`, printing the trailer lines from [plan.md](plan.md)'s "Trailer semantics" rule 4 (model line only when not omitted; agent line unless `omit && agent_email == model_email`), one per line, nothing when empty. It reads config/template from the ambient cwd and sources `commit_template.sh` itself.
- `omit` must treat both the JSON boolean `true` and the JSON string `"true"` as set (native already does; `config_chain_read` may return `"true"` with quotes for a string value — strip them before comparing).
- Message shape: the blank separator line before the trailers is printed only when `coauthor_trailers` printed at least one line.

The node agent mirrors this natively and updates the parity specs that compare both engines byte-for-byte.

## Implementation Steps

### Step 1 — Add `coauthor_trailers` to `agent_email.sh`

Add the function next to `agent_email_get` / `model_coauthor_omitted`, sourcing `commit_template.sh` (guarded, like the other `_lib` files) for `commit_template_engine_get`. Make `model_coauthor_omitted` accept the string `"true"` as well (strip surrounding quotes before the `== "true"` check). Keep `agent_email_get`'s behavior unchanged.

### Step 2 — Use it in all four shell commit scripts

Replace each script's inline `AGENT_EMAIL=...` / `model_coauthor_omitted` / trailer `echo`s with a call to `coauthor_trailers`, capturing its output and printing `echo` + the lines only when non-empty:

- `auto-new-issue/scripts/commit_issue_shell.sh` (agent `architect`)
- `auto-plan-issue/scripts/commit_plan_shell.sh` (agent `architect`)
- `auto-fix-issue/scripts/commit_change_shell.sh` (agent `$AGENT`; trailers still after the optional body and `Addresses-Comment:` blocks)
- `auto-fix-all/scripts/cleanup_artifacts_shell.sh` (agent `architect`) — source `agent_email.sh` (it already `repo_path_enter`s, so cwd is the repo), drop the hardcoded heredoc trailers. Update the header comment to say trailers now follow the shared attribution rules.

`commit_template.sh` no longer needs to be sourced directly by the scripts that only used it for the engine check (leave it if anything else in the script uses it).

## Files to Change

- `arcanum/_lib/agent_email.sh` — new `coauthor_trailers`; `model_coauthor_omitted` accepts string `"true"`.
- `auto-new-issue/scripts/commit_issue_shell.sh` — use `coauthor_trailers`.
- `auto-plan-issue/scripts/commit_plan_shell.sh` — use `coauthor_trailers`.
- `auto-fix-issue/scripts/commit_change_shell.sh` — use `coauthor_trailers`.
- `auto-fix-all/scripts/cleanup_artifacts_shell.sh` — source `agent_email.sh`, use `coauthor_trailers`.

## CI Checks

- `core` (parity specs run the shell scripts): `make core-test` (CI job: core test job in `.circleci/config.yml`).
- Shellcheck/lint as configured for `arcanum/_lib` and skill scripts, if run in CI.

## Notes

- Do not change any CLI signature; `engine_dispatch` shims (`*/scripts/<name>.sh`) stay untouched.
- Behavior change to be aware of: with `omit` set and no agent email configured (or the old template engine), the issue/plan/change commits now have no `Co-Authored-By` trailer at all — this is intended (see the issue's Backward compatibility table).
