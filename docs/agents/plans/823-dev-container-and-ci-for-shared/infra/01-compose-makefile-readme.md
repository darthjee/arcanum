# Compose service, Makefile targets, README

Add a local dev loop for `shared/`, mirroring `cli`.

- `core/docker-compose.yml`: add a `shared` service — same `build` block as `cli` (context `..`, `core/Dockerfile`, target `test`), volumes `../:/home/node/app` and `shared_node_modules:/home/node/app/shared/node_modules`, `working_dir: /home/node/app/shared`, command `sh -c "yarn install --frozen-lockfile && yarn test"`. Declare `shared_node_modules` under `volumes:`. Extend the header comment with a sentence on the `shared` service.
- Root `Makefile`: add `SHARED_SERVICE := shared` next to `CLI_SERVICE`, and targets `shared-install`, `shared-lint`, `shared-test`, `shared-check` (`shared-lint shared-test`), `shared-shell`, `shared-audit`, built exactly like their `cli-*` counterparts with `$(YARN_INSTALL)` (no build step in `shared-test`). Add all six to `.PHONY` and a header-comment paragraph.
- `shared/README.md`: in the "run it" section, lead with `make shared-test` / `make shared-check` / `make shared-lint` from the repo root, keeping host `yarn install && yarn lint && yarn test` as the alternative.

Verify: `make shared-check` passes locally.

## Files to Change
- `core/docker-compose.yml` — new `shared` service and volume, header comment
- `Makefile` — `SHARED_SERVICE`, six `shared-*` targets, `.PHONY`, header comment
- `shared/README.md` — run instructions via `make shared-*`
