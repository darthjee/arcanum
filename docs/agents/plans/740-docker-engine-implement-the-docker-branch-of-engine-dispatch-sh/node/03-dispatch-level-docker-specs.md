# Dispatch-level docker specs

Extend the existing `core/spec/bin/engineDispatchDocker_spec.js` (created in #739 for the reading rule and the shell/native mode table) with every remaining case in `docs/agents/specs/docker/testing.md` → "Dispatch-level specs". Each case asserts stdout, the exact stderr (warning lines from the shared contract), the exit code and the fake's argv log. Fixture commands: `auto-fix-all-config-get` (dual, with `config_get_shell.sh`) and `dispatch-fixture-crash`.

- **Resolution table**: `ARCANUM_IN_DOCKER=1` (no docker call at all), `host-only`, `native`, `shell`, Docker unavailable (no binary on `PATH`; `image inspect` daemon error; image missing with pull and build failing), and `docker` → `run`.
- **Native-only** under docker follows the table, with no hard error and never a shell script.
- **argv**: the fixed flags and their order, no `-t`/`--name`, `--user` matching `id -u`/`id -g`, `-w` and the repo mount. Also the worktree common-dir mount (`createGitFixtureRepo` + `git worktree add`), the log dir mount when `engine.log.location` is set, each `--needs` tag's mounts and env (gh via `FAKE` token env; ssh vs https remote), `-e` entries name-only, `HOME`/`PATH` never forwarded, and the image tag.
- **Path arguments**: outside the repo with `ro` (the file is mounted) and `rw` (the parent is mounted), inside the repo, relative, absent, empty string, missing file, and nested-mount collapse.
- **Exit codes and streams**: 0, 1, 3, 4 and a signal code pass through; stdout and stderr stay separate. 125/126/127 from `run` fall back to native exactly once, with Docker's stderr before the warning.
- **Image acquisition**: missing image → `pull`; pull failing → `build` with `--target runtime` and the version build arg (install-root fixture with `arcanum.json`); a dev install (git fixture with no tag) → `local-<sha>` with no pull. `Info:` lines go to stderr only, with stdout empty apart from the command's own output. Point `XDG_CACHE_HOME` at the temp dir.
- **Nested guard env**: with `ARCANUM_IN_DOCKER=1`, the native call forwards the infrastructure env (each only when set); without it, nothing extra. Check this with a fixture command that echoes its env, or through `dispatch-fixture-crash`'s output if it exposes env.

Update the file's header comment, which currently says these cases are "added by the later #729 sub-issues".

## Files to Change

- `core/spec/bin/engineDispatchDocker_spec.js` — new docker cases.
