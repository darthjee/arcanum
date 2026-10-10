# Issue: Promote docker engine design into architecture docs

## Description

Part of epic #724 (implement `engine.mode=docker`). See the epic for scope, the fallback rule (entrypoint not docker-ready or Docker unavailable → `engine_dispatch.sh` falls back internally to native on the host with a stderr warning), and the open points.

Once every entrypoint is ticked in `docs/agents/specs/docker/checklist.md`, promote the permanent docker engine design from `docs/agents/specs/docker.md` and `docs/agents/specs/docker/*.md` into the architecture docs. Depends on all implementation sub-issues (the batch sub-issues created by #730). Whether it also waits on the scripts not routed through dispatch (#733) is decided in #751.

## Problem

The docker engine design lives only in the temporary spec, about 900 lines across `docs/agents/specs/docker.md` and six parts (image, mounts, environment, dispatch, testing, checklist). Architecture docs, code comments and agent files all link into `docs/agents/specs/docker*`. Once the spec is deleted (next sub-issue), those links break and the permanent design is lost, unless it is first moved into `docs/agents/architecture/`.

## Expected Behavior

- A single new `docs/agents/architecture/docker-engine.md` holds the permanent docker engine design: image, mounts, environment, dispatch and testing. It is trimmed to what stays true after the rollout. Rollout-only material (sub-issue map, per-batch plans, open points already decided) is dropped.
- `docs/agents/architecture/script-engine.md` describes the docker execution path as implemented (no "not implemented yet" wording) and its fallback rules, and links to `docker-engine.md` instead of the spec.
- `docs/agents/architecture/shared-state-and-configuration.md` is updated where it describes `engine.mode=docker`.
- `docs/agents/specs/shell-engine-removal.md` records that its docker-mode prerequisite is met.
- No file outside `docs/agents/specs/`, `docs/agents/issues/` and `docs/agents/plans/` references `docs/agents/specs/docker*` any more.
- `docs/agents/specs.md` keeps its Docker Engine row, with status "Implemented — pending removal" plus a link to `architecture/docker-engine.md`. The deletion sub-issue removes the row.
- The temporary docker-checklist drift rule is gone from `.claude/agents/scripter.md` and `.claude/agents/skill-reviewer.md`, including skill-reviewer's matching rejection reason.

## Solution

### Architecture docs (architect)

- Write `docs/agents/architecture/docker-engine.md` (one file, not an index plus parts).
- Update `script-engine.md`, `shared-state-and-configuration.md`, `entrypoint-migration-status.md` and `shell-engine-removal.md` as described above.
- Update `docs/agents/specs.md`'s Docker Engine row (status "Implemented — pending removal", link to the architecture doc).
- `AGENTS.md:101`: replace the `docs/agents/specs/docker.md` example of a split spec with a generic placeholder (`docs/agents/specs/<topic>.md` with parts under `docs/agents/specs/<topic>/`).
- Remove the "Temporary: docker migration checklist (epic #724)" sections from `.claude/agents/scripter.md` and `.claude/agents/skill-reviewer.md`, plus skill-reviewer's checklist rejection reason.

### Code comments and generators (scripter)

Repoint `docs/agents/specs/docker/*` references to the matching section of `docs/agents/architecture/docker-engine.md` in:

- `arcanum/_lib/engine_dispatch.sh`
- `arcanum/_lib/engine_dispatch_docker.sh`
- `arcanum-check-config/scripts/check_config.sh`
- `scripts/generate_entrypoint_migration_status.sh`: the header line it emits must change, then regenerate `docs/agents/architecture/entrypoint-migration-status.md`.
- `scripts/docker_benchmark.sh`

### Docker files and infra agent (infra)

- `core/docker-runtime-entrypoint.sh` and `core/docker-runtime-env.sh`: repoint their comments.
- `.claude/agents/infra.md`: repoint its `docs/agents/specs/docker/image.md` reference.

### Checklist data

`checklist.md`'s per-row `credentials`/`mounts`/`env` data is **not** carried over. The shims' `--needs`/`--path-arg` declarations and `migration-status.json` (rendered in `entrypoint-migration-status.md`) are the lasting source of truth. The checklist is removed together with the rest of the spec in the next sub-issue.

### Out of scope

- Deleting `docs/agents/specs/docker.md` and `docs/agents/specs/docker/` (including `checklist.md`): next sub-issue.
- Deciding whether this issue waits on #733's not-dispatched scripts: #751.

### Owner

architect (docs, `AGENTS.md`, agent files), with scripter (script comments and generator) and infra (`core/` docker files, `infra.md`).

## Benefits

- The permanent docker design survives the spec's deletion and sits next to the rest of the script-engine architecture.
- Removing the drift rule and the dangling links leaves the spec deletion as a pure `rm` with no follow-up edits.
