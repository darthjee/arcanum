# Makefile build and smoke-check targets

Add to the root `Makefile`, next to the `core-*` targets (extract the image name and Dockerfile path into variables, per infra conventions):

- `RUNTIME_IMAGE ?= darthjee/arcanum:local-test`, `RUNTIME_VERSION ?= $(shell tr -d '[:space:]' < arcanum.version)` (dev checkout; overridable).
- `core-build-runtime`: `docker build -f core/Dockerfile --target runtime --build-arg ARCANUM_VERSION=$(RUNTIME_VERSION) -t $(RUNTIME_IMAGE) .`
- `core-smoke-runtime` (depends on `core-build-runtime`): run the image as the host uid with the dispatch-like flags — `docker run --rm --user "$$(id -u):$$(id -g)" --read-only --tmpfs /tmp ...` — and check:
  1. the arcanum CLI starts (a no-side-effect invocation, e.g. its usage/`--help` output or a known read-only command) and exits as expected;
  2. the passwd entry resolves — override the entrypoint to run `sh -c '. arcanum-entrypoint env setup && getent passwd "$(id -u)" && ssh -V && gh --version && git --version'`, or equivalent; `ssh -G localhost` is a good check that `getpwuid` works;
  3. `/opt/arcanum/arcanum.json` reports `$(RUNTIME_VERSION)`.
- Add both to `.PHONY`. #729's `docker-parity` reuses `core-build-runtime`.

If the entrypoint needs a way to run setup without exec'ing the CLI for check 2, prefer a separate `--entrypoint sh` run that sources the same setup logic, rather than adding a debug mode to the entrypoint.

## Files to Change
- `Makefile` — `RUNTIME_IMAGE`/`RUNTIME_VERSION` variables, `core-build-runtime` and `core-smoke-runtime` targets.
