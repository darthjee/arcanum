# Register commands and add parity specs

- Add the 8 entries from [plan.md](../plan.md#command-names-and-native-invocations) to `COMMANDS` in `core/lib/core/commands.js`, and update the header doc comment's `context` lists. `core/bin/arcanum` dispatches through this registry and needs no change of its own.
- Add parity specs under `core/spec/bin/` that run each command through the shell implementation and through native, following the existing `*Parity_spec.js` / `*Parity/` specs and `core/spec/support/utils/parityEnv.js`:
  - config: get, is-enabled (true and false), set (valid and invalid value), toggle, missing key
  - rewrite-queue: push (new and duplicate), pop (non-empty and empty)
  - github remove-tag: with a stubbed GitHub
  - monitor loop: one bounded cycle against stubbed GitHub, comparing the files written (`issue-<id>.json`, both queues, cursor) and the log lines with timestamps removed
- Verify that `engine_dispatch.sh` routes correctly under `engine.mode=native` and `engine.mode=shell` for at least one command of each family.

## Files to Change
- `core/lib/core/commands.js` — 8 new entries
- `core/spec/bin/monitorIssues*Parity*` — new parity specs
