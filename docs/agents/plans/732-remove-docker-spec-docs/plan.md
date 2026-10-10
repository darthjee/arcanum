# Plan: Remove docker spec docs

Issue: [732-remove-docker-spec-docs.md](../../issues/732-remove-docker-spec-docs.md)

## Overview

Delete the temporary docker spec (`docs/agents/specs/docker.md` and `docs/agents/specs/docker/`) and its row in `docs/agents/specs.md`, then make sure no live link to it remains. The architect does this directly. Other agents are involved only if the final grep finds a non-comment hit in their files.

## Context

#731 promotes the lasting design into `docs/agents/architecture/docker-engine.md` and repoints every `specs/docker` reference outside `docs/agents/{specs,issues,plans}/`, using the anchor mapping table in [#731's plan](../731-promote-docker-engine-design-into-architecture-docs/plan.md#target-doc-and-anchor-mapping). It also repoints `docs/agents/specs/shell-engine-removal.md` (which links `docker.md` relatively) and leaves the `specs.md` Docker Engine row marked "Implemented — pending removal (#732)".

Gate: start only once #731 is merged and `docs/agents/architecture/docker-engine.md` exists on `main`. If it does not, stop and report it; do not delete anything.

## Implementation Steps

### Step 1 — Delete the spec and its index row

- `git rm -r docs/agents/specs/docker.md docs/agents/specs/docker/` (`checklist.md`, `dispatch.md`, `environment.md`, `image.md`, `mounts.md`, `testing.md`).
- In `docs/agents/specs.md`, remove the Docker Engine table row entirely, per the index's own rule ("When a spec is fully implemented and removed, its entry is removed too"). Do not repoint it to the architecture doc, and keep the file itself.

### Step 2 — Sweep remaining references

Run both checks; each must print nothing:

```bash
# Absolute-ish paths anywhere in the repo, except historical issues/plans.
grep -rn "specs/docker" . --exclude-dir=.git --exclude-dir=node_modules \
  | grep -v "^./docs/agents/\(issues\|plans\)/"

# Relative links from files next to the spec (e.g. shell-engine-removal.md uses `](docker.md)`).
grep -rnE "\]\((\./)?docker(\.md|/)" docs/agents/specs docs/agents/specs.md
```

For each hit, repoint it to `docs/agents/architecture/docker-engine.md` with #731's mapping table (`docker/<part>.md#<anchor>` → `docker-engine.md#<anchor>`; `docker/checklist.md` → remove, or point at `docs/agents/architecture/entrypoint-migration-status.md`). Candidates #731 may have missed: `.dockerignore`, `Makefile`, `core/Dockerfile`, comments added by later batch PRs.

Comment-only and doc-only hits are fixed by the architect directly. A hit that is not a comment (an emitted string, a spec assertion) goes to the owning specialist: `scripter` for `arcanum/_lib/`, `*/scripts/` and `scripts/` (re-running `scripts/generate_entrypoint_migration_status.sh` if its emitted header changes), `infra` for Docker/Makefile files, `node` for `core/bin`, `core/lib` and `core/spec`.

Files under `docs/agents/issues/` and `docs/agents/plans/` are historical and are left untouched, even though their links break.

## Files to Change

- `docs/agents/specs/docker.md` — deleted.
- `docs/agents/specs/docker/` (6 files) — deleted.
- `docs/agents/specs.md` — Docker Engine row removed.
- Any file the Step 2 sweep finds — reference repointed.

## CI Checks

- No CI job validates markdown links. If Step 2 touches `core/`, run `make core-check` (CircleCI `test` and `lint`); if it touches shell scripts, run `bash -n` on them.

## Notes

- Expected result when #731 is complete: Step 2 finds nothing, and the PR is just the deletion plus one table row.
- `AGENTS.md`'s split-spec example is already made generic by #731; if it still names `specs/docker`, Step 2 catches it.
