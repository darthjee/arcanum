# Wire the entrypoint into core/Dockerfile

Update `core/Dockerfile` to copy in and use the new entrypoint script, keeping the `apt-get install jq` step running as root (it must run before any privilege drop, since installing packages needs root).

Order of directives after this change:
1. `FROM darthjee/node:0.2.1` (unchanged)
2. `RUN apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*` (unchanged, still root)
3. `WORKDIR /home/node/app` (unchanged)
4. Copy in `core/docker-entrypoint.sh`, make it executable
5. `ENTRYPOINT ["docker-entrypoint.sh"]` — this is what starts as root and drops to `node` (see step 01); do **not** add a `USER node` directive directly, since the entrypoint itself needs to start as root to do the chown before dropping privileges
6. `CMD ["sh", "-c", "yarn install --frozen-lockfile && yarn test"]` (unchanged — becomes the argument the entrypoint execs as `node`)

No changes needed to `core/docker-compose.yml` — the entrypoint script is self-contained inside the image.

## Files to Change

- `core/Dockerfile` — add `COPY`/`RUN chmod +x` for the entrypoint script and an `ENTRYPOINT` directive, positioned after the `apt-get install jq` step; `CMD` stays as-is.
