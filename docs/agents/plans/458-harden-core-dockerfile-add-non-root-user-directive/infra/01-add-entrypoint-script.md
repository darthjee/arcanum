# Add non-root entrypoint script

Create a small shell entrypoint that runs as root just long enough to fix ownership of the mount points the non-root `node` user needs to write to, then execs the container's original command as `node`. This is the standard "start as root, drop privileges" Docker pattern, needed because:

- The `core_node_modules` named volume (mounted at `/home/node/app/core/node_modules`, see `core/docker-compose.yml`) is created owned `root:root` by Docker, since that exact path doesn't already exist inside the image.
- The bind-mounted repo root (`../:/home/node/app`) inherits host UID ownership on Linux, which may not match uid 1000.

The script should:
1. `chown -R node:node` the `core_node_modules` mount point (and, defensively, the bind-mounted app root — skip if already correctly owned, to avoid a slow recursive chown across the whole repo on every container start; scope it as narrowly as possible, e.g. just the `node_modules` directory and `core/`'s immediate working directory).
2. Use `exec gosu node "$@"` (or `su-exec`, or `su node -c`, whichever is available/simplest to install on the `darthjee/node` base — check what's already present in the image before adding a new package) to hand off to the original `CMD` as the `node` user, preserving signal handling (`exec`, not a subshell).

## Files to Change

- `core/docker-entrypoint.sh` (new) — the chown-then-drop-privileges script described above, executable (`chmod +x`).
