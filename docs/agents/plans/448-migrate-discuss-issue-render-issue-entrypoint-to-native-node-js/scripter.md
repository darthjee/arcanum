# scripter Plan: Migrate discuss-issue-render-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — in particular: the command name `discuss-issue-render-issue` must match exactly what `node` registers in `core/lib/core/commands.js`, and the shim must derive `REPO_PATH` itself (this entrypoint's existing callers never pass one) rather than requiring callers of `render_issue.sh` to change.

## Steps

- [01 — Extract the shell implementation](scripter/01-extract-shell-script.md)
- [02 — Create the engine_dispatch shim](scripter/02-create-shim.md)
- [03 — Flip the migration-status flag](scripter/03-migration-status.md)

## Notes

- `discuss-issue/scripts/confirm.sh` is the closest existing reference for both the shim shape and the "derive REPO_PATH from ambient git checkout" convention — read it in full before writing this one.
- No CI job runs `discuss-issue/scripts/*.sh` directly in isolation; these are exercised indirectly by whichever skill steps call `render_issue.sh`/`render_issue_shell.sh`, and directly by `node`'s parity test (`core/spec/bin/discussIssueRenderIssueParity_spec.js`).
