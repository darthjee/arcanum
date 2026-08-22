# scripter Plan: Add logs to native nodejs calls

Main plan: [plan.md](plan.md)

## Shared contracts

Produces env var `ARCANUM_REPO_PATH`, consumed by `node`'s `core/bin/arcanum` change. See [plan.md](plan.md)'s "Shared contracts" for the full contract.

## Implementation Steps

### Step 1 — Pass `ARCANUM_REPO_PATH` to the native invocation

In `arcanum/_lib/engine_dispatch.sh`'s `engine_dispatch()`, where `native_cmd` is assembled (currently `env -i PATH="$PATH"` plus the per-command `env_args` allowlist), add `ARCANUM_REPO_PATH="$repo_path"` unconditionally — infrastructure-level, alongside `PATH`, not part of the per-command `env_allowlist` a caller opts into. This is the only change needed here; the dispatch guard doesn't otherwise know or care that logging exists on the other side.

## Files to Change
- `arcanum/_lib/engine_dispatch.sh` — add `ARCANUM_REPO_PATH="$repo_path"` to the `native_cmd` env assembly, before invoking `core/bin/arcanum`.

## Notes
- No spec changes anticipated here: `arcanum/_lib/engine_dispatch.sh` has no dedicated spec file today (bash), and the new env var's effect is exercised by `node`'s `core/spec/bin/arcanum_spec.js` integration cases, which set `ARCANUM_REPO_PATH` directly rather than going through this script. If the target repo later adds shell-level tests for `engine_dispatch.sh`, cover: the var is present and equals `repo_path` when native mode actually dispatches; absent effect is unaffected for `shell`/`docker`/fallback branches (they never build `native_cmd` at all).
