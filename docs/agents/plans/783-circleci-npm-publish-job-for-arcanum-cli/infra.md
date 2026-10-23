# Plan: CircleCI npm publish job for arcanum-cli

Main plan: [plan.md](plan.md)

## Overview
Add `scripts/publish_cli_package.sh` with a fake-`npm` test script, the `publish-cli` CircleCI job, a Makefile dry-run target, and docs. The job uses **npm trusted publishing** (CircleCI OIDC) instead of the spec's `NPM_TOKEN`; per the issue, the spec is updated to that decision.

## Context
- The design comes from `docs/agents/specs/arcanum-cli/packaging-and-release.md` → Release: the seven script steps, the failure handling and the dist-tags.
- `scripts/publish_runtime_image.sh` is the model for the script's shape: a header doc, `set -euo pipefail`, a self-locating `REPO_ROOT` and echoed progress.
- The `cli` test job runs on `darthjee/circleci_node:0.2.1`, which has Node 22.14.0. Trusted publishing needs Node ≥ 22.14.0 and npm ≥ 11.5.1, and the image's npm version is unknown.
- The root `scripts/test_*.sh` scripts are standalone bash checks with a `fail()` helper. They are run by hand and are not wired into CI.
- The Makefile's `cli-*` targets run inside the `cli` compose service (`core/docker-compose.yml`). That service mounts the repo at `/home/node/app`, with `working_dir` `/home/node/app/cli`.

## Steps

- [01 — Publish script and its test](infra/01-publish-script.md)
- [02 — CircleCI publish-cli job](infra/02-circleci-job.md)
- [03 — Makefile dry-run target](infra/03-makefile-target.md)
- [04 — Docs and spec update](infra/04-docs.md)

## CI Checks
- `scripts/`: `bash scripts/test_publish_cli_package.sh` (run by hand; not a CI job)
- `.circleci/`: `circleci config validate` if the CLI is available; otherwise check the YAML by eye against the sibling jobs
- `docs/`: the markdownlint config already used in the repo, if any CI job lints docs

## Notes
- **Nothing can publish before the bootstrap.** This PR does not publish anything. The first real publish happens on the next release tag after the owner's one-time manual bootstrap (see step 04). A release tagged before then fails `publish-cli` at the publish step. That is expected, and is recovered with "Rerun workflow from failed".
- **Pin npm exactly.** If the image's npm is older than 11.5.1, upgrade it in the job with an exact version (e.g. `npm install -g npm@11.21.1`, the latest 11.x when this plan was written), never a range. That keeps the supply-chain rule of exact pins.
- **No secret handling.** Do not add an `NPM_TOKEN` path or any `.npmrc` auth line. The script should also refuse to run a real publish when an `NPM_TOKEN` or `NODE_AUTH_TOKEN` is set, so a stray token cannot silently bypass OIDC and drop provenance.
- **Stale header comment.** `.circleci/config.yml`'s header says the cli build bundles `../core/lib`. Since #824 it bundles `shared/lib`. Fix that line while editing the header.
