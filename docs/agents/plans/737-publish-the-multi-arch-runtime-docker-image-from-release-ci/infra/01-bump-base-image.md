# Bump the base image to the multi-arch darthjee/node
Blocked on darthjee/docker#148. Once it ships a multi-arch `darthjee/node:<new>` tag, change `FROM darthjee/node:0.2.1 AS base` to that tag. As the pin comment requires, re-check every apt pin in the `base` stage against the new image (the versions must exist for both amd64 and arm64). The `gh` tarball step already picks its per-arch SHA-256 via `dpkg --print-architecture`, so it needs no change. Update the `FROM` pin comment if it mentions amd64-only.

Verify:
- `make core-build-runtime` and `make core-smoke-runtime` still pass.
- `make core-test` still passes (the `test` target shares `base`).
- `docker buildx build -f core/Dockerfile --target runtime --platform linux/amd64,linux/arm64 --build-arg ARCANUM_VERSION=0.0.0 .` succeeds (arm64 under QEMU/binfmt on an amd64 host, or natively on Apple Silicon).

## Files to Change
- `core/Dockerfile` — new `darthjee/node` tag in the `base` stage, re-checked apt pins
