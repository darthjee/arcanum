# Issue: Spec: docker dispatch and testing

## Description

Part of epic #724 (implement `engine.mode=docker`), phase 1 (spec). Depends on #725 (index + checklist, done); #726 (image, mounts, environment, done) is the input this part builds on.

Write the two remaining parts of the docker spec, replacing today's stubs: `docs/agents/specs/docker/dispatch.md` and `docs/agents/specs/docker/testing.md`. Also update the index (`docs/agents/specs/docker.md`): status, the open points this issue resolves, and the sub-issue map row for #727.

## Problem

`image.md`, `mounts.md` and `environment.md` say what the container looks like, but not how `arcanum/_lib/engine_dispatch.sh` drives it. Several open points in the index are explicitly deferred to #727, and #729 (the docker branch of `engine_dispatch.sh` with a pilot entrypoint) cannot start until they are settled:

- the docker-readiness source of truth (and how dispatch knows a command is `host-only`);
- per-call `docker run` vs. a long-lived container with `docker exec` (performance);
- TTY handling for `/dev/tty`-owning dispatched scripts;
- the dispatch-side half of the nested-call guard;
- exit-code/stream passthrough and Docker's own 125–127 failures;
- the rest of concurrency (container naming);
- how a shim tells dispatch which of its arguments are paths to mount (`args:ro`/`args:rw`, deferred by `mounts.md`).

There is also no testing strategy for docker mode.

## Expected Behavior

### `dispatch.md`

The docker branch of `engine_dispatch.sh`, decided precisely enough for #729 to implement without further design:

- **Resolution order** under `engine.mode=docker`, as one decision table: `ARCANUM_IN_DOCKER=1` → native directly; host-only → native on host; not docker-ready → native on host (then native → shell if no native); Docker unavailable → native on host; otherwise docker. Each fallback warns on stderr and keeps stdout/exit code unchanged.
- **Docker-readiness source of truth:** `arcanum/_lib/migration-status.json` is extended (decided). Its values change from `true`/`false` to a shape that also encodes docker-ready and `host-only` (for example `"native" | "docker" | "host-only"`, or an object), and the native-only commands get entries too. The spec defines the exact shape, the reading rule that replaces `_engine_dispatch_native_available`, and the migration of existing values. The checklist stays hand-maintained regardless.
- **`docker run` invocation shape:** assembled from the mounts, env and image parts (`--rm`, `--user`, `-w`, `-v`, `-e NAME`, image tag resolution). Per-call `docker run` is the default (decided). The spec names the benchmark (which hot scripts, macOS and Linux) and the threshold that would justify switching to a long-lived container with `docker exec`. #729 measures it with the pilot entrypoint.
- **Docker availability check:** what is checked (binary, daemon, image present), its cost per call, and whether it is cached.
- **Native-only commands** under docker, replacing today's hard error.
- **Argument path declaration:** how a shim tells dispatch which arguments are `args:ro`/`args:rw` paths.
- **Exit codes and streams:** exact passthrough (incl. 3/4), stdout/stderr kept separate, and how Docker's own 125–127 failures are distinguished from script exit codes (fallback vs. error).
- **Nested-call guard:** where the `ARCANUM_IN_DOCKER` check sits and how not-docker-ready / native-only commands behave when nested inside the container.
- **TTY:** no TTY in the container, ever (decided). `/dev/tty`-owning dispatched scripts always take their exit-4 `FALLBACK=chat` path under docker, and skills use their existing `AskUserQuestion` fallback. No `-it`. The spec lists which dispatched commands this affects. Non-dispatched TTY scripts such as `next_step_prompt.sh` stay with #733.
- **Concurrency:** no fixed container names; cleanup on interrupt (no orphaned containers).

### `testing.md`

How docker mode is tested:

- **CI:** bin-level routing specs for the resolution table, with `docker` stubbed (a fake `docker` on `PATH` that records its argv). They cover every branch, including the fallbacks, exit-code passthrough and 125–127 handling, and run in the existing CircleCI jobs (decided).
- **Local only:** real-container parity (docker output vs. native output for the same command), behind a `make` target. No machine-executor job in CircleCI (decided). CircleCI's `setup_remote_docker` can't bind-mount host paths.
- The spec says which parity cases are required before ticking a checklist row as ✅.

### Index

`docs/agents/specs/docker.md` status, open points and sub-issue map updated to reflect what #727 resolves.

## Solution

Docs-only change, owned by `architect`. No script, image or CI change here — those belong to #728/#729. Decisions recorded in the dispatch part must stay consistent with `mounts.md`/`environment.md`; if a decision here requires changing those parts, update them in the same PR.
