# Infra Plan: Promote docker engine design into architecture docs

Main plan: [plan.md](plan.md)

## Shared contracts

You **consume** `docs/agents/architecture/docker-engine.md` and the anchor mapping table in [plan.md](plan.md#target-doc-and-anchor-mapping). Start after the architect has written that file. Comments and docs only: no image change.

## Implementation Steps

### Step 1 — Repoint docker file comments and infra.md

- `core/docker-runtime-entrypoint.sh` (line 4) and `core/docker-runtime-env.sh` (lines 5, 17): `docs/agents/specs/docker/image.md#runtime-user-and-entrypoint` → `docs/agents/architecture/docker-engine.md#runtime-user-and-entrypoint`, and `docs/agents/specs/docker/environment.md` → `docs/agents/architecture/docker-engine.md#environment`.
- `.claude/agents/infra.md` (line 19): `docs/agents/specs/docker/image.md` → `docs/agents/architecture/docker-engine.md#image`.
- Re-run `grep -rn "specs/docker" core/ Makefile .claude/agents/infra.md --exclude-dir=node_modules --exclude-dir=lib --exclude-dir=spec --exclude-dir=bin` and fix any other hit in infra-owned files (Dockerfile, compose, Makefile).

## Files to Change
- `core/docker-runtime-entrypoint.sh` — comment.
- `core/docker-runtime-env.sh` — comments.
- `.claude/agents/infra.md` — doc link.

## CI Checks
- `make core-smoke-runtime` locally is optional (comment-only change). `bash -n` on both scripts.
