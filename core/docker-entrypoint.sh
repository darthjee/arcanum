#!/bin/sh
# Entrypoint for the core/ test image (see core/Dockerfile).
#
# Runs as root just long enough to fix ownership of the mount points the
# non-root `node` user (uid 1000/gid 1000, built into the darthjee/node
# base image) needs to write to, then drops privileges to `node` to run
# the container's actual command (CMD, or whatever `docker compose run`
# overrides it with).
#
# Two kinds of mount point need this:
# - The `core_node_modules` and `cli_node_modules` named volumes (see
#   core/docker-compose.yml, services `core` and `cli`) are created owned
#   root:root by Docker, since those paths don't already exist inside the
#   image (the repo is bind-mounted, not baked in). Each is chowned only
#   if it exists, since a service mounts only its own volume.
# - The bind-mounted repo root (../:/home/node/app) inherits host UID
#   ownership on Linux, which may not match uid 1000; core/ and cli/ are
#   only chowned (non-recursively) if they aren't already writable by
#   `node`, to avoid a slow recursive chown across the whole repo on
#   every container start.
set -e

APP_DIR=/home/node/app
CORE_DIR="$APP_DIR/core"
CLI_DIR="$APP_DIR/cli"
PACKAGE_DIRS="$CORE_DIR $CLI_DIR"

for package_dir in $PACKAGE_DIRS; do
    node_modules_dir="$package_dir/node_modules"

    if [ -d "$node_modules_dir" ]; then
        chown -R node:node "$node_modules_dir"
    fi

    if [ -d "$package_dir" ] && ! su node -s /bin/sh -c "[ -w \"$package_dir\" ]"; then
        chown node:node "$package_dir"
    fi
done

# shellcheck disable=SC2016 # $0/$@ meant to expand inside the su'd subshell, not here
exec su node -s /bin/sh -c 'exec "$0" "$@"' -- "$@"
