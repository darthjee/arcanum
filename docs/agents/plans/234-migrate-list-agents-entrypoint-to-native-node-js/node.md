# node Plan: Migrate list-agents entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Must produce the exact `<name>|<description>` CLI contract described in `plan.md`'s "Shared contracts" — this is what `scripter`'s parity test setup (running both scripts) will be checked against.
- Reuses `core/lib/RepoPath.js`'s `validate()` for the `repo_path` check (already introduced by #233) — do not write a new repo-path validator.
- Registers the `list-agents` key in `core/bin/arcanum`'s `COMMANDS` table so `scripter`'s shell shim (`list_agents.sh`) can dispatch to it via `engine_dispatch`.

## Steps

- [01 — Add the native ListAgents implementation](node/01-add-list-agents-native.md)
- [02 — Wire list-agents into the arcanum CLI router](node/02-wire-arcanum-router.md)
- [03 — Unit tests for ListAgents](node/03-unit-tests.md)
- [04 — Parity test: shell vs. native](node/04-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Keep zero runtime npm dependencies — only built-in `node:fs`/`node:path` APIs, matching every other `core/lib/` module.
- Frontmatter extraction must replicate `list_agents_shell.sh`'s exact semantics: only the first `---`-delimited block, only `name:`/`description:` lines matched as `^field:[ ]*value`, surrounding single or double quotes stripped, first match wins, missing `name` skips the file entirely (its `description` is simply empty string if also missing) — not a general YAML parser.
