# Issue: Harden core/Dockerfile: pin apt-get install package versions (jq)

## Context

`core/Dockerfile` installs `jq` via `apt-get install -y --no-install-recommends jq` without pinning a specific package version. `jq` is a genuine runtime dependency used by shell scripts under `arcanum/_lib/` and `auto-fix-all/scripts/` (e.g. `repo_config.sh`), and it is also relied on by the `engine.mode=docker` execution path described in `docs/agents/architecture/script-engine.md`. Without a pinned version, rebuilding the image at a later date can silently pull in a different `jq` version than what was originally tested against, which can lead to non-reproducible builds and hard-to-diagnose behavior differences between environments (e.g. flag support, output formatting, or subtle parsing differences across `jq` releases).

The base image (`darthjee/node:0.2.1`) is Debian 12 (bookworm); the current candidate version reported by `apt-cache policy jq` inside that image is `1.6-2.1+deb12u2`.

## Expected Behavior

- [ ] `core/Dockerfile`'s `apt-get install` command for `jq` specifies an explicit, pinned package version (`jq=1.6-2.1+deb12u2`).
- [ ] The image still builds successfully with the pinned version against the current base image (`darthjee/node:0.2.1`).
- [ ] The rationale/process for updating the pinned version in the future is documented as a comment in the Dockerfile.

## Solution

- Pin the `jq` package in `core/Dockerfile`'s `apt-get install` line to the current bookworm candidate version: `jq=1.6-2.1+deb12u2`.
- Add a comment directly above (or beside) the pinned line explaining how to determine/refresh the pin in the future, e.g. run `apt-cache policy jq` inside the `darthjee/node:0.2.1` base image (`docker run --rm darthjee/node:0.2.1 sh -c "apt-get update -qq && apt-cache policy jq"`) and update the version string when bumping.
- No `--allow-downgrades` or similar flag is needed: this is a fresh `apt-get update` in a `RUN` layer with no prior `jq` install to conflict with.
- The repo has no existing convention for documenting pinned apt package versions (unlike the base image tag pin, which only has a purpose comment, not an update-process comment) — this issue introduces that convention via the Dockerfile comment above.
- `docs/agents/architecture/script-engine.md` does not currently reference the `jq` installation step or its version, so no changes are needed there.

## Benefits

- Reproducible image builds: rebuilding at a later date won't silently pull in a different `jq` version.
- Reduces risk of hard-to-diagnose behavior differences (flag support, output formatting, parsing) across environments caused by an unpinned `jq` release.
- Establishes a documented convention for pinning and refreshing apt package versions in this Dockerfile, which can be reused for future dependencies.
