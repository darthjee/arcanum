#!/bin/sh
# Entrypoint for the core/ runtime image (the `runtime` target of
# core/Dockerfile, used by engine.mode=docker). See
# docs/agents/specs/docker/image.md#runtime-user-and-entrypoint.
#
# Gives the arbitrary, non-root container uid a passwd/group entry via
# nss_wrapper (see core/docker-runtime-env.sh), then execs the arcanum
# CLI with the arguments dispatch passed. No root phase, no chown, no su.
#
# core/docker-entrypoint.sh is the test image's entrypoint, not this one.
set -eu

ARCANUM_RUNTIME_ENV=/usr/local/lib/arcanum-runtime-env.sh
ARCANUM_CLI=/opt/arcanum/core/bin/arcanum

# shellcheck source=core/docker-runtime-env.sh
. "$ARCANUM_RUNTIME_ENV"

exec "$ARCANUM_CLI" "$@"
