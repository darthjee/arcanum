# Register commands and bin routing spec

Register both commands in `core/lib/core/commands.js` (`context: 'repo'`), update
`commands_spec.js`'s command list, and add a bin-level routing spec that runs the real
`arcanum-create-issue/scripts/start.sh` and `publish.sh` shims end to end through
`engine_dispatch --native-only` in every `engine.mode` (docker → the native-only error), modeled on
`core/spec/bin/arcanumCheckConfig_spec.js`. Use stubbed GitHub access (no network).

## Files to Change

- `core/lib/core/commands.js` — two new entries
- `core/spec/lib/core/commands_spec.js` — expected command list
- `core/spec/bin/arcanumCreateIssue_spec.js` — new routing spec
