# Scripter Plan: Promote docker engine design into architecture docs

Main plan: [plan.md](plan.md)

## Shared contracts

You **consume** `docs/agents/architecture/docker-engine.md` and the anchor mapping table in [plan.md](plan.md#target-doc-and-anchor-mapping). Start after the architect has written that file. Comments only: no behaviour change.

## Implementation Steps

### Step 1 — Repoint script comments

Replace every `docs/agents/specs/docker*` reference in comments, per the mapping table. Known today: `arcanum/_lib/engine_dispatch.sh` (~line 116), `arcanum/_lib/engine_dispatch_docker.sh` (lines 3, 25, 157, 183, 242), `arcanum-check-config/scripts/check_config.sh` (~line 21) and `scripts/docker_benchmark.sh` (lines 6–7). The batch PRs (#745–#749) may have added references in other shims, so re-run `grep -rn "specs/docker" arcanum/ */scripts/ scripts/` and fix every hit.

### Step 2 — Generator header and regeneration

`scripts/generate_entrypoint_migration_status.sh` emits the header of `docs/agents/architecture/entrypoint-migration-status.md` with a link to `../specs/docker/dispatch.md#docker-readiness-source-of-truth` (line 74), plus a comment at line 6. Change the link to `docker-engine.md#docker-readiness-source-of-truth` (same folder as the generated file) and the comment to the new path. Then regenerate the doc with the script and commit the result. The diff should touch only that header line.

## Files to Change
- `arcanum/_lib/engine_dispatch.sh` — comment.
- `arcanum/_lib/engine_dispatch_docker.sh` — comments.
- `arcanum-check-config/scripts/check_config.sh` — comment.
- `scripts/docker_benchmark.sh` — comment.
- `scripts/generate_entrypoint_migration_status.sh` — emitted header link and comment.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.
- Any other shim the re-grep finds.

## CI Checks
- `scripts/check_tags_table.sh` is the only script-side CI check and is unaffected. Run `bash -n` on every touched script.
