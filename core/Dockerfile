# Images for the core/ Node.js package — one file, one set of pins.
#
# See docs/agents/specs/docker/image.md and
# docs/agents/architecture/script-engine.md. Stages:
#
# - base:    darthjee/node plus the pinned tools both targets need (jq,
#            git, openssh-client, libnss-wrapper, gh).
# - test:    the core/ test image used by core/docker-compose.yml and the
#            root Makefile's core-* targets. Source is intentionally NOT
#            copied/baked in: the repo is bind-mounted at runtime, so local
#            edits are picked up without a rebuild. Dependency
#            installation happens at container start, reusing the warm
#            Yarn cache the base image already provides.
# - runtime: the image engine.mode=docker runs commands in. Bakes the
#            arcanum install layout into /opt/arcanum, runs as an
#            arbitrary non-root uid (no root phase, no chown, no su) and
#            execs core/bin/arcanum. Build it from the install root:
#              docker build -f core/Dockerfile --target runtime \
#                --build-arg ARCANUM_VERSION=<version> \
#                -t darthjee/arcanum:<version> <install root>
#
# The build context is the install root (not core/), filtered by the
# root .dockerignore.

# Pinned by exact tag only (no digest). To refresh: pick the new
# darthjee/node release tag, then re-check every apt pin below against it.
FROM darthjee/node:0.2.1 AS base

# Hadolint DL4006: fail the build if any command in a pipe fails.
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Every apt package is pinned for reproducible builds, from the base
# image's Debian release (bookworm for darthjee/node:0.2.1). To find the
# current candidate version for this base image (e.g. when refreshing a
# pin), run:
#   docker run --rm darthjee/node:0.2.1 sh -c \
#     "apt-get update -qq && apt-cache policy jq git openssh-client libnss-wrapper"
# Debian ships the same version for amd64 and arm64.
#
# - jq: a genuine runtime dependency of the shell scripts under
#   arcanum/_lib/ and auto-fix-all/scripts/ (e.g. repo_config.sh) that
#   native-invocation/parity specs and engine.mode=docker shell out to.
#   darthjee/node doesn't include it.
# - git, openssh-client: already in the base image, re-pinned here so the
#   test and runtime images can't drift (git over SSH needs both).
# - libnss-wrapper: gives the arbitrary runtime uid a passwd/group entry
#   without root or a writable /etc/passwd (OpenSSH aborts with "No user
#   exists for uid" otherwise) — see core/docker-runtime-entrypoint.sh.
#   Its .so lives under an arch-specific multiarch dir, so it is
#   symlinked to a fixed path for an arch-independent LD_PRELOAD.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        jq=1.6-2.1+deb12u2 \
        git=1:2.39.5-0+deb12u3 \
        openssh-client=1:9.2p1-2+deb12u10 \
        libnss-wrapper=1.1.12-1 \
    && rm -rf /var/lib/apt/lists/* \
    && nss_wrapper_so="$(dpkg -L libnss-wrapper | grep -E '/libnss_wrapper\.so$')" \
    && ln -s "$nss_wrapper_so" /usr/local/lib/libnss_wrapper.so \
    && test -e /usr/local/lib/libnss_wrapper.so

# gh comes from the official release tarball (Debian's own package lags
# far behind; no third-party apt repo), pinned by version and verified
# against a per-arch SHA-256 before extraction.
#
# The architecture is read from the base image's own dpkg
# (`dpkg --print-architecture`: amd64/arm64), which matches buildx's
# TARGETARCH whenever the base image provides that platform, and also
# stays correct with the legacy builder or when an amd64-only base image
# is run under emulation on an arm64 host.
#
# To refresh: bump GH_VERSION, then copy the two hashes for
# gh_<version>_linux_amd64.tar.gz and gh_<version>_linux_arm64.tar.gz
# from that release's gh_<version>_checksums.txt, e.g.
#   gh release download v<version> --repo cli/cli \
#     --pattern 'gh_<version>_checksums.txt' --output - \
#     | grep -E 'linux_(amd64|arm64)\.tar\.gz'
ARG GH_VERSION=2.102.0
ARG GH_SHA256_AMD64=bb766f710eef8ede859c18578c72c327597cd4c8a85b06001b1f3843c6019386
ARG GH_SHA256_ARM64=7862c86c72f43df3a2d93ddde6f473285b4e2af61b494849846827e513ef6484
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
        amd64) sha256="$GH_SHA256_AMD64" ;; \
        arm64) sha256="$GH_SHA256_ARM64" ;; \
        *) echo "unsupported architecture for gh: $arch" >&2; exit 1 ;; \
    esac \
    && tarball="gh_${GH_VERSION}_linux_${arch}.tar.gz" \
    && tmp_dir="$(mktemp -d)" \
    && curl -fsSL -o "$tmp_dir/$tarball" \
        "https://github.com/cli/cli/releases/download/v${GH_VERSION}/${tarball}" \
    && echo "${sha256}  $tmp_dir/$tarball" | sha256sum -c - \
    && tar -xzf "$tmp_dir/$tarball" -C "$tmp_dir" \
    && install -m 0755 "$tmp_dir/gh_${GH_VERSION}_linux_${arch}/bin/gh" /usr/local/bin/gh \
    && rm -rf "$tmp_dir" \
    && gh --version

FROM base AS test

WORKDIR /home/node/app

# Starts as root to fix ownership of mount points the non-root `node`
# user needs to write to, then drops privileges to `node` before
# running CMD — see core/docker-entrypoint.sh for the full rationale.
# No USER directive is added here: that would make docker-entrypoint.sh
# itself run as `node`, breaking its `chown -R node:node` calls against
# the root-owned `core_node_modules` volume and (when needed) the
# bind-mounted repo root. Semgrep's missing-USER findings for this
# stage are suppressed in .codacy.yml (see #494/#604).
COPY core/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "yarn install --frozen-lockfile && yarn test"]

FROM base AS runtime

# The installed arcanum version, written to /opt/arcanum/arcanum.json so
# InstallVersion resolves the same version inside the container as on
# the host (the context's .git is never copied). Required.
ARG ARCANUM_VERSION

ARG ARCANUM_ROOT=/opt/arcanum

# The install layout (same file set as scripts/build_release_zip.sh,
# filtered by the root .dockerignore), not just core/: native commands
# also need arcanum/_lib/ and skill scripts/ and templates/.
COPY . $ARCANUM_ROOT

# Production dependencies only. core/package.json has no runtime
# dependencies today, so this installs nothing — it stays so adding one
# doesn't silently break the image. The tree is then made read-only for
# everyone but root: the container runs --read-only as an arbitrary uid.
WORKDIR $ARCANUM_ROOT/core
RUN test -n "$ARCANUM_VERSION" \
        || { echo "ARCANUM_VERSION build arg is required" >&2; exit 1; } \
    && yarn install --production --frozen-lockfile --non-interactive \
    && yarn cache clean \
    && jq -n --arg version "$ARCANUM_VERSION" '{version: $version}' \
        > "$ARCANUM_ROOT/arcanum.json" \
    && chmod -R a+rX,go-w "$ARCANUM_ROOT"

# A writable HOME that doesn't depend on the uid: created at start by the
# entrypoint under the --tmpfs /tmp dispatch passes. gh and git write
# small caches here; nothing persists between calls.
ENV HOME=/tmp/arcanum-home

# The entrypoint sources the runtime user setup (nss_wrapper passwd/group
# entry) from a separate file, so `make core-smoke-runtime` can check the
# same setup without exec'ing the CLI.
COPY core/docker-runtime-env.sh /usr/local/lib/arcanum-runtime-env.sh
COPY core/docker-runtime-entrypoint.sh /usr/local/bin/arcanum-entrypoint
RUN chmod 0644 /usr/local/lib/arcanum-runtime-env.sh \
    && chmod 0755 /usr/local/bin/arcanum-entrypoint

# Non-root default; dispatch always overrides it with
# --user "$(id -u):$(id -g)". No root phase, no chown, no su.
USER 1000:1000

ENTRYPOINT ["arcanum-entrypoint"]
