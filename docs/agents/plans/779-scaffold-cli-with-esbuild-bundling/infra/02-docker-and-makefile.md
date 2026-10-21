# Docker and Makefile cli-* targets

- **`core/docker-compose.yml`:** add a `cli` service that reuses `core/Dockerfile`'s `test` stage (same build, context `..`, target `test`). It:
  - mounts the whole repo (`../:/home/node/app`);
  - adds a named volume `cli_node_modules:/home/node/app/cli/node_modules`;
  - sets `working_dir: /home/node/app/cli`.

  Declare the volume.
- **`core/docker-entrypoint.sh`:** generalize the `node_modules` chown, which today is hardcoded to `core/node_modules`. Chown each of `core/node_modules` and `cli/node_modules` that exists, with the paths kept in variables, so `yarn install` works as `node` on the root-owned volume.
- **Root `Makefile`:**
  - Add `CLI_SERVICE := cli`, reusing `CORE_COMPOSE` or adding `CLI_COMPOSE`.
  - Add targets `cli-install`, `cli-lint`, `cli-build`, `cli-test` (`yarn build && yarn test`), `cli-check` (lint then test), `cli-shell` and `cli-audit`. Each runs `yarn install --frozen-lockfile` first, like the `core-*` targets.
  - Add them all to `.PHONY` and update the header comment.

Verify with `make cli-check` once `client`'s `cli/` files exist, and confirm `make core-check` still passes.

## Files to Change

- `core/docker-compose.yml` — `cli` service and `cli_node_modules` volume.
- `core/docker-entrypoint.sh` — chown for both `node_modules` volumes.
- `Makefile` — `cli-*` targets, `.PHONY`, header comment.
