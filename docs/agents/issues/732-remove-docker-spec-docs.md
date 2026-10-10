# Issue: Remove docker spec docs

## Description

Part of epic #724 (implement `engine.mode=docker`). Final cleanup step: delete the temporary docker spec (`docs/agents/specs/docker.md` and `docs/agents/specs/docker/`) once its lasting content has been promoted to `docs/agents/architecture/docker-engine.md` by #731.

Depends on #731 (merged). #731 already repoints every `specs/docker` reference outside `docs/agents/{specs,issues,plans}/` to the architecture doc, rewrites the `AGENTS.md` split-spec example as a generic placeholder, and marks the `docs/agents/specs.md` row as "Implemented — pending removal (#732)" while keeping its link.

## Problem

The docker spec was a temporary, forward-looking design. Once #731 lands, it duplicates `docs/agents/architecture/docker-engine.md` and its per-command checklist is fully ticked, so keeping it invites drift and confuses which document is authoritative.

## Expected Behavior

- `docs/agents/specs/docker.md` and the whole `docs/agents/specs/docker/` folder (`checklist.md`, `dispatch.md`, `environment.md`, `image.md`, `mounts.md`, `testing.md`) are deleted.
- The Docker Engine row is removed from `docs/agents/specs.md`, per that index's rule ("When a spec is fully implemented and removed, its entry is removed too"). The index file itself stays.
- No live reference to the deleted files remains. This prints nothing:

  ```bash
  grep -rn "specs/docker" . --exclude-dir=.git --exclude-dir=node_modules \
    | grep -v "^./docs/agents/\(issues\|plans\)/"
  ```

  Historical issue and plan files under `docs/agents/issues/` and `docs/agents/plans/` are left untouched: they record past work and are not rewritten.
- Any residual hit that #731 missed (e.g. comments added by later PRs, `.dockerignore`, `Makefile`, `core/Dockerfile`) is repointed to `docs/agents/architecture/docker-engine.md` using #731's anchor mapping table.

## Solution

Owner: `architect` (docs-only deletion plus the `specs.md` row). If the grep finds residual hits in another agent's files, the architect fixes them directly when they are comment-only, or delegates to the owning specialist (`scripter`, `infra`, `node`).

1. Confirm #731 is merged and `docs/agents/architecture/docker-engine.md` exists.
2. `git rm -r docs/agents/specs/docker.md docs/agents/specs/docker/`.
3. Remove the Docker Engine row from `docs/agents/specs.md`.
4. Run the grep above and repoint any remaining hit.

## Benefits

- A single authoritative description of the docker engine (`docs/agents/architecture/docker-engine.md`).
- Closes the last open sub-issue of epic #724's documentation track.
