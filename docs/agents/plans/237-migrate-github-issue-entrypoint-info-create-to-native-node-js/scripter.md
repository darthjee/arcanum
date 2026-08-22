# scripter Plan: Migrate github-issue entrypoint (info, create) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- `github-issue-info`/`github-issue-create` are the exact `migration-status.json` keys — must match node's `COMMANDS` registry keys and the shim's `engine_dispatch` command argument, byte-for-byte.
- `engine_dispatch` passes the *same* trailing args to its shell and native branches — it cannot give each branch a different argv. The shim must therefore keep those trailing args to just `<repo_path> [title file]` (no sub-command name) via the two fixed wrapper scripts below, so node's `info(repoPath)`/`create(repoPath, title, file)` methods receive exactly the args they expect.
- `HOME` must be in the shim's env allowlist (`create`'s native path needs it for `gh auth token`, transitively via `GithubToken#get`).

## Steps

- [01 — Split github_issue.sh into shell impl + engine_dispatch shim](scripter/01-split-into-shim-and-shell.md)
- [02 — Add per-subcommand keys to migration-status.json](scripter/02-add-migration-status-keys.md)
- [03 — Regenerate entrypoint-migration-status.md](scripter/03-regenerate-status-doc.md)

## Notes

- No CircleCI job exercises `arcanum/_lib/*.sh` changes directly (the `test`/`checks` jobs are Node/`core`-only) — correctness here leans on node's parity specs (which invoke `github_issue_shell.sh` directly) plus manual verification: run `bash arcanum/_lib/github_issue.sh info "$REPO_PATH"` in both `engine.mode=shell` and `engine.mode=native` (once node's Steps 1–3 have landed) and confirm identical output.
- `arcanum/_lib/test_engine_dispatch.sh` (from #192) already covers `engine_dispatch` generically via fixture commands — no changes needed there; this issue doesn't add new `engine_dispatch` behavior, just a new caller of it.
