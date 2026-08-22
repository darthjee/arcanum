# node Plan: Migrate issue-state entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Implements `IssueState#run(repoPath, subcommand, id, field, value)`, dispatching internally on `subcommand` ∈ `get|set|set-json|append-json`, registered in `core/bin/arcanum`'s `COMMANDS` map under the key `issue-state`.
- CLI argument order is `<repo_path> <subcommand> <id> <field> [value]` — repo_path before the subcommand, matching the shell script's own order.
- Must validate `repoPath` via `core/lib/RepoPath.js#validate` (the `repo_path_enter` native equivalent from #233) before dispatching.
- Must reuse `core/lib/Lock.js` for locking (mandatory — no second inline lock implementation) and reuse `write`'s read/merge/write internals wherever a new method's merge semantics overlap with it.
- Output/exit-code contract (byte-identical to `arcanum/_lib/issue_state_shell.sh`, which scripter extracts): see plan.md's "Shared contracts" for the full get/set/set-json/append-json behavior and JSON merge semantics.
- scripter's shim depends on this command being registered before wiring `arcanum/_lib/issue_state.sh` to dispatch through it; architect's `migration-status.json` flip depends on this work (and scripter's) being complete and tested.

## Steps

- [01 — Extend IssueState.js with the four subcommands](node/01-extend-issue-state.md)
- [02 — Register the issue-state command](node/02-register-command.md)
- [03 — Unit tests for the new methods](node/03-unit-tests.md)
- [04 — Parity test vs the shell implementation](node/04-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- `set`'s value is always a string (mirrors the shell script's unquoted `$5`); `set-json`/`append-json` parse `value` as JSON before merging — match `jq`'s `--argjson` semantics (invalid JSON should behave the same way the shell script does, i.e. `jq` erroring; check `issue_state_shell.sh`'s actual behavior on invalid JSON once extracted, and replicate it rather than guessing).
- `get` must never throw on a missing state file, missing lock directory, or missing field — same relaxed-read behavior as `write`'s existing `_read`/`_write`... reuse it directly rather than re-implementing.
