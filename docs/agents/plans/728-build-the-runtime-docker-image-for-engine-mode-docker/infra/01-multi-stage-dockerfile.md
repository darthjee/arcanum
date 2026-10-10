# Multi-stage Dockerfile with pinned base

Rewrite `core/Dockerfile` into three stages, keeping one set of pins for both images.

- **`base`** — `FROM darthjee/node:0.2.1 AS base` (exact tag, no digest). Install, pinned as `pkg=<version>` with `--no-install-recommends` in one `apt-get` layer that clears `/var/lib/apt/lists`: `jq` (existing pin), `git`, `openssh-client`, `libnss-wrapper`, plus anything needed to fetch/verify `gh` (`curl`/`ca-certificates` if not already in the base). Keep the existing "how to find the current candidate" comment style next to each pin.
- **`gh` in `base`** — `ARG GH_VERSION=<x.y.z>`, `ARG TARGETARCH`, and per-arch `GH_SHA256_AMD64` / `GH_SHA256_ARM64` args. Download `gh_${GH_VERSION}_linux_${TARGETARCH}.tar.gz` from the GitHub release, verify with `sha256sum -c`, install the binary to `/usr/local/bin/gh`, remove the tarball. A local `docker build` without buildx must still get `TARGETARCH` (BuildKit sets it; document the fallback `--build-arg TARGETARCH=$(...)` if the legacy builder is used). Comment the refresh procedure: bump `GH_VERSION`, copy the two hashes from the release's `gh_<v>_checksums.txt`.
- **nss_wrapper path** — after install, symlink the arch-specific `libnss_wrapper.so` to `/usr/local/lib/libnss_wrapper.so`.
- **`test`** — `FROM base AS test`: today's content unchanged (`WORKDIR /home/node/app`, `COPY core/docker-entrypoint.sh`, `ENTRYPOINT`, `CMD`). Because the build context becomes the install root (step 03), `COPY` paths gain the `core/` prefix.
- **`runtime`** — `FROM base AS runtime`:
  - `ARG ARCANUM_VERSION` (required; fail the build if empty).
  - `COPY . /opt/arcanum` (context filtered by `.dockerignore`, step 03).
  - `RUN cd /opt/arcanum/core && yarn install --production --frozen-lockfile && yarn cache clean` (installs nothing today; kept so a future runtime dependency doesn't silently break).
  - Write `/opt/arcanum/arcanum.json` with `{"version": "<ARCANUM_VERSION>"}` (jq), so `InstallVersion` resolves the host's version.
  - `ENV HOME=/tmp/arcanum-home`, `ENV ARCANUM_INSTALL_ROOT`-style vars only if the spec requires them (it doesn't today).
  - Make `/opt/arcanum` world-readable/executable, not writable (the container runs `--read-only` as an arbitrary uid).
  - `COPY core/docker-runtime-entrypoint.sh /usr/local/bin/arcanum-entrypoint` (step 02), `ENTRYPOINT ["arcanum-entrypoint"]`, no `CMD` beyond an empty/`--help` default.
  - `USER 1000:1000` as a non-root default (dispatch always overrides with `--user "$(id -u):$(id -g)"`); no root phase, no `chown`, no `su`.

Update the file header comment to describe both targets and point to `docs/agents/specs/docker/image.md`.

## Files to Change
- `core/Dockerfile` — multi-stage rewrite (`base`, `test`, `runtime`), pinned `git`/`openssh-client`/`libnss-wrapper`/`gh`.
