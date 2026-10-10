# Issue: Docker engine: migrate migration-status.json to a status enum

## Description

Part of #729 (epic #724). First of three sub-issues. This one only changes the docker-readiness map (`arcanum/_lib/migration-status.json`) and how it is read. No docker behavior is added: under `engine.mode=docker`, dual entrypoints keep today's warning and shell fallback, and native-only commands keep today's hard error, until the docker branch lands.

## Problem

`migration-status.json` is a boolean map ("does a native implementation exist") that lists only dual entrypoints. The docker branch needs to know more than that for every dispatch command, native-only ones included: whether it is docker-ready, native-only on the host, or still shell-only. `docs/agents/specs/docker/dispatch.md` → "Docker-readiness source of truth" defines the replacement string enum and its reading rule.

## Expected Behavior

- `migration-status.json` holds one string value per dispatch command: `"shell"`, `"native"`, `"docker"` or `"host-only"`. Native-only commands are listed too.
- `engine_dispatch` reads the map through `_engine_dispatch_status`. Under `engine.mode=shell` and `native`, every command behaves exactly as it does today. No value is `"docker"` yet.
- The generated status doc and every doc or agent definition that describes the map as booleans, or says native-only commands are not listed, match the new format.

## Solution

**Map rewrite (one commit)**, per the spec's "Migration of existing values":

- every `true` → `"native"` (including the `dispatch-fixture-crash` test fixture);
- `arcanum-update-run-update-apply`, `arcanum-update-run-update-check` and `auto-fix-issue-run-checks` → `"host-only"`;
- add the native-only commands `arcanum-check-config`, `arcanum-create-issue-start`, `arcanum-create-issue-publish` and `init-claude-set-next-step-auto` as `"native"`;
- the pilot is **not** flipped to `"docker"` here. #741 does that.

**Dispatch (`arcanum/_lib/engine_dispatch.sh`)**

- Add `_engine_dispatch_status <command> <native_only>` to replace `_engine_dispatch_native_available`. It prints `shell`, `native`, `docker` or `host-only` and always exits 0, following the spec's reading-rule table:
  - known string → that value (`"shell"` reads as `native` for native-only);
  - legacy `true`/`false` → `native`/`shell` for dual entrypoints, `native` for native-only;
  - missing key, unknown value, missing or malformed file → `shell` for dual entrypoints, `native` for native-only.
- Only the dual-entrypoint path calls it, in `native` mode: any status other than `shell` runs native, and `shell` keeps today's warning and shell fallback. The `--native-only` path is unchanged in this sub-issue, so it does not consult the map and keeps the docker hard error. The function is still unit-tested for `--native-only`.
- The `engine.mode=docker` branch for dual entrypoints is unchanged.

**Generator and generated doc**

- `scripts/generate_entrypoint_migration_status.sh`: rename the `Migrated` column to `Status` and print the raw enum value. The `Issue` column keeps its current meaning, the commit that introduced the key, so the 4 native-only keys will show #739. Remove the "native-only commands are not tracked" note and update the header wording to match.
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` with the script. Never hand-edit it.

**Other readers (docs and agent definitions)**

- `docs/agents/architecture/script-engine.md`: describe the map as the enum and say native-only commands are listed.
- `docs/agents/specs/shell-engine-removal.md`: the precondition becomes "no entry is `shell`". Drop "not listed in `migration-status.json`".
- `docs/agents/architecture/arcanum-create-issue.md`: drop "neither is in `migration-status.json`".
- `docs/agents/architecture/skill-finish.md`: `finish-report` is `"native"`, not `true`.
- `.claude/agents/node.md` and `.claude/agents/scripter.md`: new native-only commands get a `"native"` entry in the map, instead of "do not add them".

**Tests**

- `arcanum/_lib/test_engine_dispatch.sh`: update this standalone smoke script, which CI doesn't run, for the new reading rule.
- Create `core/spec/bin/engineDispatchDocker_spec.js` as `docs/agents/specs/docker/testing.md` describes. It drives a `bash -c` wrapper that sources `engine_dispatch.sh` and points `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` at a fixture map. Fixture commands are `dispatch-fixture-crash` and `auto-fix-all-config-get`. Cases in this sub-issue:
  - **Reading rule:** call `_engine_dispatch_status` directly for legacy `true`/`false`, missing key, unknown value, missing file and malformed file, for a dual entrypoint and for a `--native-only` call.
  - **Other modes:** `engine.mode=shell` and `native` against each of the four status values, per the spec's mode table.
  - Later sub-issues add the docker cases to the same file.

**Owner**

- scripter: `engine_dispatch.sh`, `test_engine_dispatch.sh`, `scripts/generate_entrypoint_migration_status.sh`, the map.
- node: `core/spec/bin/engineDispatchDocker_spec.js`, the `node`/`scripter` agent-definition wording.
- architect: docs.

## Benefits

- Gives the docker branch (#729 and its later sub-issues) one source of truth for docker-readiness per command, native-only commands included.
- Ships the format change on its own, with no behavior change and CI coverage of the reading rule, so the docker work builds on a tested base.
