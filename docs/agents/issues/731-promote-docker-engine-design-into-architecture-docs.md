# Issue: Promote docker engine design into architecture docs

## Description

Part of epic #724 (implement `engine.mode=docker`). See the epic for scope and for the fallback rule: if an entrypoint is not docker-ready or Docker is unavailable, `engine_dispatch.sh` falls back internally to native on the host with a stderr warning.

Promote the permanent docker engine design from `docs/agents/specs/docker.md` and `docs/agents/specs/docker/*.md` into the architecture docs. Order: #733 → #731 → #732 (as decided in #751).

**Gate (met as of 2026-10-12):** every row in `docs/agents/specs/docker/checklist.md` is ✅ or `n/a`, no row still has kind `TBD (#733)`, and #733 and #753 (`permission-grant-add`) are closed.

## Problem

The docker engine design lives only in the temporary spec: about 940 lines across `docs/agents/specs/docker.md` and six parts (image, mounts, environment, dispatch, testing, checklist). About 75 files outside `docs/agents/specs/`, `docs/agents/issues/` and `docs/agents/plans/` link into `docs/agents/specs/docker*`: architecture docs, agent files, `AGENTS.md`, nearly every shim script header, the `core/` Node.js entrypoint and specs, and the Docker build files. Once the spec is deleted (#732), those links break and the permanent design is lost, unless it is first moved into `docs/agents/architecture/`.

## Expected Behavior

- A single new `docs/agents/architecture/docker-engine.md` holds the permanent docker engine design, with one top-level section per former spec part: image, mounts, environment, dispatch and testing. It also covers #733's per-kind decision for scripts not routed through dispatch (sourced libraries, thin wrappers, non-dispatched entrypoints, install/update bootstraps). It keeps only what stays true after the rollout and drops rollout-only material (sub-issue map, per-batch plans, open points already decided). Sub-headings that existing references point at keep stable anchors (e.g. "Resolution order", "Exit codes and streams", "Git remote access", "Runtime user and entrypoint", "Distribution and versioning", "Credentials", "Fake `docker`", "Dispatch-level specs", "Parity specs (local only)").
- `docs/agents/architecture/script-engine.md` describes the docker execution path as implemented, with no "not implemented yet" wording, plus its fallback rules. It links to `docker-engine.md` instead of the spec.
- `docs/agents/architecture/shared-state-and-configuration.md` is updated where it describes `engine.mode=docker`.
- `docs/agents/specs/shell-engine-removal.md` records that its docker-mode prerequisite is met.
- **Acceptance check:** `grep -rE "specs/docker" --exclude-dir=.git .` returns no hit outside `docs/agents/specs/`, `docs/agents/issues/` and `docs/agents/plans/`. Each repointed reference links to the matching section anchor of `docs/agents/architecture/docker-engine.md` (e.g. `dispatch.md` → `docker-engine.md#dispatch`, `dispatch.md#resolution-order` → the matching sub-anchor), not only to the file.
- `docs/agents/specs.md` keeps its Docker Engine row, with status "Implemented — pending removal" and a link to `architecture/docker-engine.md`. #732 removes the row.
- The temporary docker-checklist drift rule is gone from `.claude/agents/scripter.md` and `.claude/agents/skill-reviewer.md`, including skill-reviewer's matching rejection reason.

## Solution

The work is split by owner. Each agent repoints every `specs/docker*` reference in its own scope, using the grep above as the definition of done. Files are not listed one by one, because the set changes as scripts are added.

### Architecture docs and agent files (architect)

- Write `docs/agents/architecture/docker-engine.md` as one file (not an index plus parts). Write it first so the section anchors exist for the other agents.
- Update `script-engine.md`, `shared-state-and-configuration.md`, `install-and-release.md` and `shell-engine-removal.md` as described above.
- Update the Docker Engine row in `docs/agents/specs.md` (status "Implemented — pending removal", link to the architecture doc).
- `AGENTS.md`: replace the `docs/agents/specs/docker.md` example of a split spec with a generic placeholder (`docs/agents/specs/<topic>.md` with parts under `docs/agents/specs/<topic>/`).
- Remove the "Temporary: docker migration checklist (epic #724)" sections from `.claude/agents/scripter.md` and `.claude/agents/skill-reviewer.md`, plus skill-reviewer's checklist rejection reason.

### Scripts (scripter)

- Repoint every reference under `<skill>/scripts/`, `arcanum/_lib/` and `scripts/`. This covers the boilerplate shim headers ("falls back to the host with a warning — see …dispatch.md and …environment.md"), `engine_dispatch.sh`, `engine_dispatch_docker.sh`, `check_config.sh` and `docker_benchmark.sh`.
- `scripts/generate_entrypoint_migration_status.sh`: change the header line it emits, then regenerate `docs/agents/architecture/entrypoint-migration-status.md`.

### Node.js (node)

- Repoint references in `core/bin/arcanum` and under `core/spec/`, which point at `dispatch.md` and `testing.md` sections.

### Docker build files (infra)

- Repoint references in `Makefile`, `.dockerignore`, `core/Dockerfile`, `core/docker-runtime-entrypoint.sh`, `core/docker-runtime-env.sh` and `.claude/agents/infra.md`.

### Checklist data

The per-row `credentials`/`mounts`/`env` data in `checklist.md` is **not** carried over. The lasting source of truth is the shims' `--needs`/`--path-arg` declarations and `migration-status.json`, which `entrypoint-migration-status.md` renders. The checklist is removed with the rest of the spec in #732.

### Out of scope

- Deleting `docs/agents/specs/docker.md` and `docs/agents/specs/docker/`, including `checklist.md`. That is #732.

### Owner

architect (docs, `AGENTS.md`, agent files), with scripter (scripts), node (`core/bin`, `core/spec`) and infra (Docker build files, `infra.md`).

## Benefits

- The permanent docker design survives the spec's deletion and sits next to the rest of the script-engine architecture.
- Removing the drift rule and every dangling link means deleting the spec in #732 is a plain `rm`, with no follow-up edits.
