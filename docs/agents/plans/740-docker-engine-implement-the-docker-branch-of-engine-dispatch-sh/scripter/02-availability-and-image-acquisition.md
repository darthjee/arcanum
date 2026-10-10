# Availability check and image acquisition

Implement `_engine_dispatch_docker_image_ref` and `_engine_dispatch_docker_available` in `engine_dispatch_docker.sh`, per `dispatch.md` → "Docker availability check" and `image.md` → "Distribution and versioning":

1. `command -v docker`, or reason `docker not found`.
2. Resolve the ref: `_ENGINE_DISPATCH_DOCKER_IMAGE` if non-empty, else from `_ENGINE_DISPATCH_INSTALL_ROOT` (version from `arcanum.json`, else the exact tag via `git describe --tags --exact-match`, else `local-<short HEAD>`).
3. `docker image inspect --format '{{.Id}}' <ref>`. Present → available. If stderr contains `Cannot connect to the Docker daemon` → reason `daemon not reachable`.
4. Missing: take the lock at `${XDG_CACHE_HOME:-$HOME/.cache}/arcanum/image.lock` (`mkdir -p` its dir; `lock.sh`), re-inspect (another caller may have finished), then for non-`local-` refs print `Info: pulling <ref> (first docker call for this version)…` and `docker pull <ref>`; on failure (or for `local-` refs) print `Info: building <ref>…` and `docker build -f <root>/core/Dockerfile --target runtime --build-arg ARCANUM_VERSION=<version> -t <ref> <root>`. Release the lock on every path. Both failing → reason `image <ref> unavailable`.

The stdout of `inspect`/`pull`/`build` never reaches dispatch's stdout (redirect it to stderr or discard it), so a command's stdout stays clean.

## Files to Change

- `arcanum/_lib/engine_dispatch_docker.sh` — ref resolution, availability check, locked pull/build.
- `arcanum/_lib/engine_dispatch.sh` — `_ENGINE_DISPATCH_INSTALL_ROOT` and `_ENGINE_DISPATCH_DOCKER_IMAGE` defaults (reuse the existing install-root computation behind `_ENGINE_DISPATCH_NATIVE_BIN`).
