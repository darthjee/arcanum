# infra Plan: Harden core/Dockerfile: add non-root USER directive

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add non-root entrypoint script](infra/01-add-entrypoint-script.md)
- [02 — Wire the entrypoint into core/Dockerfile](infra/02-wire-entrypoint-into-dockerfile.md)
- [03 — Verify on macOS and Linux, update docs](infra/03-verify-and-update-docs.md)

## Notes

- No `.circleci/config.yml` changes are needed: the `test`/`checks` jobs there bypass `core/Dockerfile`/`docker-compose` entirely (they run `yarn install`/`yarn test` directly inside a separate `darthjee/circleci_node` image via a plain `checkout`). CI does not currently exercise this Dockerfile at all, so there's no automated check to catch a regression here — verification in Step 3 below is manual, on both macOS and a Linux host.
- The base image `darthjee/node:0.2.1` already ships a non-root `node` user (uid 1000/gid 1000, home `/home/node`), with `/home/node/app` pre-owned `node:root` — reuse it, don't create a new user.
- A companion issue was filed upstream against the base image ([darthjee/docker#146](https://github.com/darthjee/docker/issues/146)) to make named-volume ownership friendlier for non-root consumers by default; this plan's entrypoint chown step is the local workaround in the meantime and should stay even if that upstream issue is eventually fixed (harmless no-op once ownership is already correct).
