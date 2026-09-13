#!/bin/sh
# Entrypoint for the core/ test image (see core/Dockerfile).
#
# Runs as root just long enough to fix ownership of the mount points the
# non-root `node` user (uid 1000/gid 1000, built into the darthjee/node
# base image) needs to write to, then drops privileges to `node` to run
# the container's actual command (CMD, or whatever `docker compose run`
# overrides it with).
#
# Two mount points need this:
# - The `core_node_modules` named volume (see core/docker-compose.yml) is
#   created owned root:root by Docker, since that path doesn't already
#   exist inside the image (core/ is bind-mounted, not baked in).
# - The bind-mounted repo root (../:/home/node/app) inherits host UID
#   ownership on Linux, which may not match uid 1000; only chown it if
#   it isn't already writable by `node`, to avoid a slow recursive chown
#   across the whole repo on every container start.
set -e

APP_DIR=/home/node/app
CORE_DIR="$APP_DIR/core"
NODE_MODULES_DIR="$CORE_DIR/node_modules"

if [ -d "$NODE_MODULES_DIR" ]; then
    chown -R node:node "$NODE_MODULES_DIR"
fi

if [ -d "$CORE_DIR" ] && ! su node -s /bin/sh -c "[ -w \"$CORE_DIR\" ]"; then
    chown node:node "$CORE_DIR"
fi

exec su node -s /bin/sh -c 'exec "$0" "$@"' -- "$@"
