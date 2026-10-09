# Plan: Spec: docker engine index and migration checklist

Issue: [725-spec-docker-engine-index-and-migration-checklist.md](../../issues/725-spec-docker-engine-index-and-migration-checklist.md)

## Overview

Docs-only work for the architect, the first step of epic #724 (`engine.mode=docker`). It adds a permanent specs index (`docs/agents/specs.md`) and documents the split-spec folder convention. It creates the docker spec index (`docs/agents/specs/docker.md`) with stub parts, plus the per-command migration checklist (`docs/agents/specs/docker/checklist.md`). Finally, it wires links and a temporary drift rule into the agent files.

## Context

- `engine.mode=docker` is already a documented value (`docs/agents/architecture/script-engine.md`), but `arcanum/_lib/engine_dispatch.sh` only warns and falls back to shell (dual entrypoints) or errors out (native-only).
- `docs/agents/specs/` currently holds a single flat spec (`shell-engine-removal.md`), and `AGENTS.md` / `docs/agents/folder-structure.md` describe specs as `docs/agents/specs/<topic>.md` only.
- Dispatch commands come from `arcanum/_lib/migration-status.json` keys plus native-only shims (`engine_dispatch ... --native-only`). Some shims are per-subcommand routers (e.g. `auto-fix-all/scripts/github.sh`). Many scripts are not routed through `engine_dispatch` at all; #733 decides their docker handling.
- All design decisions (columns, granularity, index sections, security principles) are in the issue's Solution section. Follow them exactly.

## Steps

- [01 — Specs index and split-spec convention](plan/01-specs-index-and-convention.md)
- [02 — Docker spec index and stub parts](plan/02-docker-index-and-stubs.md)
- [03 — Migration checklist](plan/03-migration-checklist.md)
- [04 — Cross-links and temporary drift rule](plan/04-links-and-drift-rule.md)

## CI Checks

- No CI job validates `docs/agents/**` markdown (the only docs check is the non-blocking `docs/agents/tag-mutations.md` freshness check, unaffected). Verify manually: every relative link in the new/changed files resolves.

## Notes

- Never hardcode entrypoint counts in any doc.
- The one-off snippet used to populate the checklist goes in the PR description, not in the repo.
- `docs/agents/specs.md` is permanent; `docs/agents/specs/docker.md` and `docs/agents/specs/docker/` are temporary (removed by #732; #731 repoints links and removes the agent-file drift lines).
