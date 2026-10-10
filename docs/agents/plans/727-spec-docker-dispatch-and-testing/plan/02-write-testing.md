# Write testing.md

Replace the stub in `docs/agents/specs/docker/testing.md`. Header as in step 01. Sections:

1. **Layers.** A short table: routing specs (CI), parity specs (local), manual checks (macOS Docker Desktop specifics).
2. **Routing specs (CI).** Bin-level specs of `engine_dispatch.sh` under `engine.mode=docker`, with a fake `docker` executable first on `PATH` that records its argv/env to a file and exits with a configurable code. Look at how existing dispatch specs are written (search `core/spec` and any bash spec harness for `engine_dispatch` / `dispatch-fixture-crash`) and say where the new specs live and which harness they use. Cover every row of the resolution table in `dispatch.md`, the new `migration-status.json` values, the built argv (mounts and env from checklist tags, `--user`, no `-t`, no `--name`), argument path mounts, exit-code passthrough including 3/4, 125–127 handling, the unavailable-Docker fallback (fake `docker` missing or failing `image inspect`), and the `ARCANUM_IN_DOCKER=1` short-circuit. These run in the existing CircleCI jobs, with no Docker daemon needed.
3. **Parity specs (local only).** Real container vs native for the same command and inputs: byte-identical stdout, the same exit code, and the same files written (ownership included on Linux). Run them behind a `make` target (name it, for example `make docker-parity`, and note it is #729's to add, next to the existing `core-*` targets) that builds the `runtime` target first. Say which fixtures they reuse, and which cases need credentials (gh, ssh) so they are opt-in or skipped without them.
4. **Not in CI, and why.** CircleCI's `setup_remote_docker` runs a remote daemon that can't bind-mount job paths, and a machine executor was rejected for cost and complexity. Record the risk this leaves (image/runtime drift caught only locally) and the mitigation: the shared base stage with the `test` target (`image.md`), and a parity run being required before a checklist row goes ✅.
5. **Ticking a checklist row.** Required evidence per row: routing covered by the generic specs, a parity case for the command (or a documented reason it can't have one, such as host-only or credentials), and the `migration-status.json` flip in the same PR.

## Files to Change

- `docs/agents/specs/docker/testing.md` — replace the stub with the testing part described above.
