# Spec: Docker Engine

## Status

In progress, tracked by epic [#724](https://github.com/darthjee/arcanum/issues/724). Phase 1 (spec) is under way: this index and the [migration checklist](docker/checklist.md) exist, and the other parts are stubs until their sub-issues land. No docker execution path is implemented yet. Today `arcanum/_lib/engine_dispatch.sh` only warns and falls back to shell for dual entrypoints, and errors out for native-only commands. Update this section as each phase completes.

## Goal

`engine.mode=docker` runs arcanum's scripts inside a container instead of on the host. The container mounts the repo being worked on, plus whatever other paths each script needs. Each command keeps its stdout/exit-code contract unchanged, so skills do not know which engine ran it.

## Decisions so far

Summarized from epic #724:

- **Scope:**
  - In: every dual entrypoint in `arcanum/_lib/migration-status.json` (the native implementation, `core/bin/arcanum <command>`, runs inside the container), every native-only command, the docker branch of `engine_dispatch.sh`, and the runtime image.
  - Out: the top-level `scripts/` folder (repo release tooling), removing the shell engine or changing the `engine.mode` default (see [Shell Engine Removal](shell-engine-removal.md)), and running Claude Code itself in docker. Only the scripts are containerized.
- **Fallback rules:** both fallbacks happen inside `engine_dispatch.sh`, with a warning on stderr. Skills never see or handle them, and stdout/exit code are unchanged.
  - An entrypoint that is not docker-ready yet falls back to **native** on the host. If it has no native implementation, it falls back to shell, following the existing native → shell rule.
  - If Docker is unavailable at call time (daemon not running, binary missing, image not available), it falls back to **native** on the host. The warning tells the user to fix Docker or change `engine.mode`.
- **The checklist is hand-maintained:** [`docker/checklist.md`](docker/checklist.md) has one row per dispatch command. Each implementation PR ticks its own rows. The source of truth that dispatch reads to decide "docker-ready or not" is a separate decision (#727).

## Security principles

These bind every other part of this spec:

- Mount the minimum, read-only by default. A path is mounted `rw` only when the command writes to it, as recorded in the checklist's `mounts` column.
- Never bake tokens into the image or pass them as command-line arguments. Use env vars or mounted config only, and only for the commands whose checklist `credentials` column needs them.
- The container runs as the host uid, not root.
- No `--privileged`, and no Docker socket mount.

## Parts

| Part | Purpose | Written in |
| --- | --- | --- |
| [image.md](docker/image.md) | The runtime image: reuse/extend `core/Dockerfile` or add a new one, base and pins, user, entrypoint, distribution and versioning. | #726 |
| [mounts.md](docker/mounts.md) | What is mounted and how: repo (same path), git common dir for worktrees, `CLAUDE_CONFIG_DIR`, arcanum install, tmp/scratchpad; `ro` vs. `rw`; file ownership. | #726 |
| [environment.md](docker/environment.md) | Env-var allowlist to `-e` flags, credentials (`gh` token, SSH agent), the nested-call marker. | #726 |
| [dispatch.md](docker/dispatch.md) | The docker branch of `engine_dispatch.sh`: `docker run` shape, availability check and fallback, exit-code/stream passthrough, native-only commands, TTY, concurrency, docker-readiness source of truth. | #727 |
| [testing.md](docker/testing.md) | How docker mode is tested: bin-level routing specs, parity under docker, CI. | #727 |
| [checklist.md](docker/checklist.md) | One row per dispatch command, tracking which ones are docker-ready, plus the scripts not routed through dispatch. | #725 |

Scripts not routed through `engine_dispatch.sh` (sourced libraries, thin wrappers, non-dispatched entrypoints, install/update bootstraps) are listed in the checklist, but how they behave under docker is decided in #733.

## Sub-issue map

In dependency order: #725 → #726, #727 → #728 → #729 → #730 → #731 → #732. #733 runs alongside the spec phase.

| Issue | Title | Owner | Depends on | Status |
| --- | --- | --- | --- | --- |
| #725 | Spec: docker index and migration checklist | architect | — | In progress |
| #726 | Spec: docker image, mounts and environment | architect (`infra` consulted) | #725 | Open |
| #727 | Spec: docker dispatch and testing | architect | #725 | Open |
| #733 | Decide docker handling for scripts not routed through `engine_dispatch` | architect (`scripter` consulted) | #725 | Open |
| #728 | Build the runtime Docker image | infra | #726 | Open |
| #729 | Docker branch of `engine_dispatch.sh` with a pilot entrypoint | scripter (+ node if needed) | #727, #728 | Open |
| #730 | Migrate remaining entrypoints to docker (placeholder for batches) | scripter / node | #729 | Open |
| #731 | Promote docker engine design into architecture docs | architect | all of the above | Open |
| #732 | Remove docker spec docs | architect | #731 | Open |

## Open points

Each is resolved by the part/issue named:

- **TTY handling:** whether `/dev/tty`-owning scripts run with `docker run -it` or always take the exit-4 `FALLBACK=chat` path. See [dispatch.md](docker/dispatch.md) (#727), and #733 for non-dispatched TTY scripts such as `next_step_prompt.sh`.
- **Performance:** `docker run` adds startup overhead (roughly 0.3–1s per call, more on macOS Docker Desktop), and one skill run makes many script calls, more so in `auto-fix-all` loops. Choose between per-call `docker run` and a long-lived container with `docker exec`, against a rough target of under 1s overhead per call on Linux, by benchmarking a few hot scripts. See [dispatch.md](docker/dispatch.md) (#727).
- **Docker-readiness source of truth:** what dispatch reads to decide whether a command is docker-ready. See [dispatch.md](docker/dispatch.md) (#727).
- **Worktrees and path identity:** mount the repo at the same absolute path, plus the git common dir for worktrees. See [mounts.md](docker/mounts.md) (#726).
- **File ownership:** files written into the repo stay owned by the host user. `core/docker-entrypoint.sh`'s `chown` must not run against a user's repo. See [mounts.md](docker/mounts.md) and [image.md](docker/image.md) (#726).
- **Credentials:** `gh` auth (mounted config vs. `GH_TOKEN`) and git push over SSH (agent forwarding). See [environment.md](docker/environment.md) (#726).
- **Platforms:** macOS Docker Desktop vs. Linux, arm64 vs. amd64. See [image.md](docker/image.md) (#726).
- **Nested calls:** a command that shells out to another dispatched script must not start a container from inside the container (e.g. via a marker env var). See [environment.md](docker/environment.md) (#726) and [dispatch.md](docker/dispatch.md) (#727).
- **Exit codes and streams:** pass through the exact exit code (including 3/4), keep stdout and stderr separate, and never confuse Docker's own failures (125–127) with script exit codes. See [dispatch.md](docker/dispatch.md) (#727).
- **Concurrency:** no fixed container names, and the lock system keeps working across host and container processes. See [dispatch.md](docker/dispatch.md) (#727).
- **Non-dispatched scripts:** sourced libraries, thin wrappers, non-dispatched entrypoints, install/update bootstraps. Decided in #733.

## Maintenance rule (drift)

While epic #724 is open, any PR that adds or removes a script under `<skill>/scripts/` or `arcanum/_lib/` also updates [`docker/checklist.md`](docker/checklist.md) in the same PR. The rule is also stated in `.claude/agents/scripter.md` and `.claude/agents/skill-reviewer.md`, and #731 removes it from there.

## See also

- [Script Engine](../architecture/script-engine.md): the shell/native/docker dispatch design and `engine.mode`.
- [Shell Engine Removal](shell-engine-removal.md): needs a working docker mode as a prerequisite.
- [Entrypoint Migration Status](../architecture/entrypoint-migration-status.md): how dual entrypoints are tracked in `migration-status.json`.
- [Specs index](../specs.md): every current spec.
