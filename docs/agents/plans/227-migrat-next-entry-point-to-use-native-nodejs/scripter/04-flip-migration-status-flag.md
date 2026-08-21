# Flip the migration-status flag

Once `node`'s unit tests, parity test, and code review have all passed on this branch, mark `resolve-id-and-file` as available in the migration-status map — this is the switch that lets `engine.mode=native` actually route to the new native module instead of falling back to shell with a warning.

This step is deliberately last and gated — do not do it before `node`'s work is committed and verified, per [plan.md](../plan.md)'s "Gating." `architect`'s doc-generation step depends on this being done first.

## Files to Change

- `arcanum/_lib/migration-status.json` — add `"resolve-id-and-file": true`.
