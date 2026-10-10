# Plan: Spec: docker dispatch and testing

Issue: [727-spec-docker-dispatch-and-testing.md](../../issues/727-spec-docker-dispatch-and-testing.md)

## Overview

Replace the `dispatch.md` and `testing.md` stubs under `docs/agents/specs/docker/` with the full design of the docker branch of `arcanum/_lib/engine_dispatch.sh` and of how docker mode is tested. Then update the spec index (`docs/agents/specs/docker.md`) and any sibling part a decision here touches. This is a docs-only change owned by `architect`. No script, image or CI change (those belong to #728/#729).

## Context

Epic #724, phase 1. #725 (index + checklist) and #726 (image, mounts, environment) are merged. The index defers these open points to #727: the docker-readiness source of truth and host-only detection, `docker run` vs `docker exec` performance, TTY, the dispatch side of the nested-call guard, exit codes/streams, the rest of concurrency, and (from `mounts.md`) how a shim declares its path arguments.

Already decided during `/discuss-issue`:

- **Readiness:** extend `arcanum/_lib/migration-status.json`. Its values grow from `true`/`false` to a shape that also encodes docker-ready and `host-only`, and native-only commands get entries.
- **Invocation:** per-call `docker run` is the default. The benchmark and the switch threshold are specified here and measured in #729.
- **TTY:** never a TTY in the container. TTY-owning dispatched commands always take exit 4 `FALLBACK=chat`. No `-it`.
- **Testing:** routing specs with a stubbed `docker` run in the existing CircleCI jobs. Real-container parity is local only, behind a `make` target. No machine executor.

## Steps

- [01 — Write dispatch.md](plan/01-write-dispatch.md)
- [02 — Write testing.md](plan/02-write-testing.md)
- [03 — Update the index and sibling parts](plan/03-update-index-and-siblings.md)

## Notes

- Keep the tone and structure of the #726 parts: short sections, tables for decisions, links to sibling anchors, "#729 implements" pointers.
- Everything stated must stay consistent with `mounts.md` and `environment.md`. If a decision here changes one of them, edit it in the same PR rather than leaving a contradiction.
- Non-dispatched scripts (`next_step_prompt.sh`, sourced libs, bootstraps) stay with #733. Only reference them.
- The repo has no markdown lint job in CircleCI (`.markdownlint.json` exists for local/editor use). Keep tables and headings lint-clean anyway.
