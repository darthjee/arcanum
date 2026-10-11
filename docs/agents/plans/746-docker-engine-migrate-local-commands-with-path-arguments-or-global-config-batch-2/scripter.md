# Scripter Plan: Docker engine: migrate local commands with path arguments or global config (batch 2)

Main plan: [plan.md](plan.md)

## Shared contracts

Add exactly the flags in [plan.md → Shared contracts](plan.md#shared-contracts), in the `engine_dispatch` segment before `--` and after `--prepend-repo-path`, using the single-token `--flag=value` form:

- `create_sub_issue_file.sh`: `--path-arg=4:ro`
- `render_issue.sh`: `--path-arg=1:rw`
- `stamp_arcanum_version.sh`: `--needs=global-config` (keep `HOME`)
- `write_label_config.sh`: `--path-arg=1:rw` (applies to all three subcommands)

## Implementation Steps

### Step 1 — Declare docker needs in the batch-2 shims

Add the flags above to the four shims' `engine_dispatch` calls. Under `shell`/`native` the flags are ignored, so behavior there does not change. In each shim header, add a short paragraph in the batch-1 style: under `engine.mode=docker` the command runs in the container, with the repo mount plus the declared path or global-config mount, and falls back to native when Docker is unavailable. Run `arcanum/_lib/test_engine_dispatch.sh`. If a case relies on one of these commands being `native` in the real map, switch it to a temporary map, as batch 1 did for case 8.

### Step 2 — Flip status and tick the checklist

- `arcanum/_lib/migration-status.json`: set the 6 keys to `"docker"`, then regenerate the entrypoint migration status table with the existing generator (the one batch 1 used).
- `docs/agents/specs/docker/checklist.md`: tick the 6 rows ✅ with `#746`. Make sure each row's `mounts`/`env` match the shim flags. On `init-claude-stamp-arcanum-version`, add a note that `global-config:ro` follows the `HOME` allowlist rule, and that under docker the version comes from the image's `arcanum.json`. If node reports that a dev install between tags (`local-<sha>` image) stamps differently from native, record that in the same note. Leave `permission-grant-add` unticked, with a note pointing to #753.
- `docs/agents/specs/docker.md`: extend the status line that batch 1 updated to mention batch 2 (#746).

## Files to Change

- `arcanum-split-issue/scripts/create_sub_issue_file.sh`: `--path-arg=4:ro` + header.
- `discuss-issue/scripts/render_issue.sh`: `--path-arg=1:rw` + header.
- `init-claude/scripts/stamp_arcanum_version.sh`: `--needs=global-config` + header.
- `init-claude/scripts/write_label_config.sh`: `--path-arg=1:rw` + header.
- `arcanum/_lib/test_engine_dispatch.sh`: only if a case depends on these keys being native.
- `arcanum/_lib/migration-status.json` and the generated status table: 6 keys → `docker`.
- `docs/agents/specs/docker/checklist.md`: 6 rows ticked, notes.
- `docs/agents/specs/docker.md`: batch 2 status note.

## Notes

- Flip the status only once node's parity cases pass (`make docker-parity`). The PR must report the platform they ran on.
- `permission-grant-add` is out of scope (#753): leave its shim and row untouched.
