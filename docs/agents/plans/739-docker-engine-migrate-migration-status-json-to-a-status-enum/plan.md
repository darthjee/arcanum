# Plan: Docker engine: migrate migration-status.json to a status enum

Issue: [739-docker-engine-migrate-migration-status-json-to-a-status-enum.md](../../issues/739-docker-engine-migrate-migration-status-json-to-a-status-enum.md)

## Overview

Rewrite `arcanum/_lib/migration-status.json` from booleans to the `shell` / `native` / `docker` / `host-only` string enum defined in `docs/agents/specs/docker/dispatch.md` → "Docker-readiness source of truth". Add `_engine_dispatch_status` to `engine_dispatch.sh` as the single reader. Only the dual-entrypoint `native` branch uses it, so `engine.mode=shell` and `native` behave exactly as today and no docker behavior is added. Then update the generator, the regenerated status doc, the specs and every doc that describes the old boolean map.

## Agents involved

- [scripter](scripter.md): map rewrite, `_engine_dispatch_status`, smoke script, generator plus regenerated doc, native-only shim header comments.
- [node](node.md): new CI spec `core/spec/bin/engineDispatchDocker_spec.js`.
- [architect](architect.md): docs and the `node`/`scripter` agent definitions.

## Shared contracts

**Map format** (`arcanum/_lib/migration-status.json`): a flat JSON object `{ "<command>": "<status>" }`, where `<status>` is one of `"shell"`, `"native"`, `"docker"`, `"host-only"`. After this issue:

- every key that is `true` today → `"native"` (all 79, `dispatch-fixture-crash` included);
- `arcanum-update-run-update-apply`, `arcanum-update-run-update-check`, `auto-fix-issue-run-checks` → `"host-only"`;
- new keys `arcanum-check-config`, `arcanum-create-issue-start`, `arcanum-create-issue-publish`, `init-claude-set-next-step-auto` → `"native"`;
- no value is `"docker"` (#741 flips the pilot).

**Reader** (`arcanum/_lib/engine_dispatch.sh`):

```text
_engine_dispatch_status <command> <native_only>
  <native_only>: "true" | "false"
  stdout: exactly one of shell | native | docker | host-only (single line)
  exit:   always 0
```

| Map state | `<native_only>`=false | `<native_only>`=true |
| --- | --- | --- |
| `"shell"`/`"native"`/`"docker"`/`"host-only"` | that value | that value, but `"shell"` → `native` |
| legacy `true` / `false` | `native` / `shell` | `native` |
| missing key, unknown value (any other string, number, null, object), missing file, malformed JSON | `shell` | `native` |

It reads `$_ENGINE_DISPATCH_MIGRATION_STATUS_FILE`, a sourced variable that tests override after sourcing. There is no env hook. `_engine_dispatch_native_available` is removed.

**Dispatch behavior (unchanged from today):**

- `shell` mode: always `<shell_script>`.
- `native` mode, dual entrypoint: status `shell` → today's exact stderr warning `Warning: no native implementation of '<command>' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation.` plus shell. Any other status → native.
- `docker` mode, dual entrypoint: today's warning plus shell fallback, unchanged.
- `--native-only`: unchanged. It never consults the map, keeps the docker hard error, and runs native otherwise.

**Generated doc** (`docs/agents/architecture/entrypoint-migration-status.md`): columns `| Command | Status | Issue |`. `Status` is the raw enum value in backticks, e.g. `` `native` ``. `Issue` keeps its current meaning, the commit that introduced the key.

## Notes

- Order: scripter's map commit must land before the doc is regenerated. The `Issue` column for the 4 new native-only keys comes from the commit subject that adds them, so the map commit's subject must carry `#739`. `commit_change.sh` does this.
- node's spec depends on scripter's `_engine_dispatch_status`, so dispatch scripter first.
- `core/spec/bin/arcanumCheckConfig_spec.js`'s docker hard-error case stays as is. It changes in a later #729 sub-issue.
