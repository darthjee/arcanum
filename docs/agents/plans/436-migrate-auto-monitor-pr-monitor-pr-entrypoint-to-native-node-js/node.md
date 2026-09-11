# node Plan: Migrate auto-monitor-pr-monitor-pr entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — the command name, module path, CLI surface, env allowlist, output/exit-code contract, and state-file dual shape all apply here verbatim. `scripter` only needs the command name and the fact that `<repo_path>` is stripped before `args` reaches `core/bin/arcanum`.

## Steps

- [01 — Read the shell script and pin its exact contract](node/01-read-shell-contract.md)
- [02 — Extend GitHubClient with the PR-monitoring REST/GraphQL calls](node/02-extend-github-client.md)
- [03 — Build a PrMonitor service for the poll/normalize/decide logic](node/03-build-pr-monitor-service.md)
- [04 — Build AutoMonitorPrMonitorPr and wire up state-file handling](node/04-build-command.md)
- [05 — Register the command and native unit tests](node/05-register-and-test.md)
- [06 — Shell/native parity test](node/06-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- See [plan.md](plan.md)'s Notes — the shell script's own header comment about the legacy state file's shape is stale; trust the code (`save_comments_state`'s else-branch) instead.
- `push_current_branch` (best-effort, errors swallowed) has no existing native equivalent (`Git`/`GitClient` currently expose no push method) — Step 04 decides how to handle this.
