# node Plan: Migrate github-issue entrypoint (info, create) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- `github-issue-info`/`github-issue-create` are the exact `COMMANDS` registry keys — must match scripter's `migration-status.json` keys and the shim's `engine_dispatch` command argument.
- Native CLI args are just the sub-command's own positional args (no sub-command name in argv) — `info(repoPath)` receives only `repoPath`, `create(repoPath, title, file)` receives only those three. Scripter's shim guarantees this via two fixed per-subcommand wrapper scripts (see plan.md's shared contracts) rather than passing the sub-command name through `engine_dispatch`'s shared args.
- `info(repoPath)` and `create(repoPath, title, file)` must each **return a string** (the router only prints `output` when `typeof output === 'string'`), with the exact key order given below.
- `create` does not call `IssueState#write` — no state persistence, matching the shell.

## Steps

- [01 — Add `info` to GithubIssue.js](node/01-add-info-method.md)
- [02 — Add `create` to GithubIssue.js](node/02-add-create-method.md)
- [03 — Wire both into core/bin/arcanum's COMMANDS registry](node/03-wire-commands-registry.md)
- [04 — Extend GithubIssue_spec.js with info/create unit tests](node/04-extend-unit-spec.md)
- [05 — Add shell/native parity specs](node/05-add-parity-specs.md)

## CI Checks

- `core`: `make core-check` (runs `yarn lint` + `yarn test` inside the docker-compose test image; CircleCI jobs: `checks`, `test`)

## Notes

- `RepoPath.js` (landed via #233/PR #240) is reused for `create`'s repo-path validation, following the exact injection pattern already used in `SafeBranch.js`/`ListAgents.js` (`repoPath = new RepoPath()` in the constructor, `this._repoPath.validate(repoPath)` in the method — no naming collision since the instance field is always accessed via `this._repoPath`).
- `info` does **not** use `RepoPath` — confirmed the shell's `cmd_info` only calls `_load_origin`, which itself already produces the right error (`Error: '<repo_path>' is not a git repository or has no 'origin' remote`) via `Origin#resolve`'s existing `git -C <repoPath> remote get-url origin` failure path. Adding a separate `RepoPath.validate` call to `info` would change its error message/behavior and break parity.
