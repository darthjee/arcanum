# Issue: CircleCI npm publish job for arcanum-cli

## Description
Part of epic #767 (Arcanum user-facing CLI for configuration). Publish `arcanum-cli` to npm from the existing CircleCI `release` workflow, as defined in [`docs/agents/specs/arcanum-cli/packaging-and-release.md` → Release](../specs/arcanum-cli/packaging-and-release.md#release). The one exception is authentication: npm trusted publishing has supported CircleCI as an OIDC provider since April 2026, so the job uses **trusted publishing with provenance and no stored npm token**, as the spec's Provenance section anticipated.

The `cli/` scaffold this depends on is merged. None of the publish pieces exist yet: no `publish-cli` job, no `scripts/publish_cli_package.sh` and no dry-run Makefile target.

Owner: `infra`.

## Problem
`arcanum-cli` cannot be installed with `npm i -g arcanum-cli`, because nothing publishes it. Its version has to stay in lockstep with arcanum's for the version-skew checks to hold, so publishing must be automatic on every release rather than a manual step.

## Expected Behavior
- **Trigger.** A `publish-cli` job in the `release` workflow, with the same filters as its siblings (`branches: ignore: /.*/`, `tags: only: /^\d+\.\d+\.\d+$/`).
  - It `requires: [build-and-release]` and runs in parallel with `publish-image`.
  - It uses the same `darthjee/circleci_node` image as the `cli` job, with `working_directory: ~/project/cli` and a full-repo checkout.
- **The script.** The YAML is a single call to `scripts/publish_cli_package.sh <tag> [--dry-run]`, which runs, failing on any error:
  1. **Version check:** `cli/package.json` `version` must equal the tag, and the tag must be bare `X.Y.Z`.
  2. **Already published?** If `npm view arcanum-cli@<tag> version` returns it, stop with success.
  3. `yarn install --frozen-lockfile`.
  4. `yarn lint`, `yarn build` and `yarn test`, which includes the smoke specs on the bundle.
  5. **Content check:** `npm pack --dry-run --json` lists exactly `bin/arcanum`, `dist/arcanum.mjs`, `README.md` and `package.json`.
  6. `npm publish` with **trusted publishing (OIDC)**, which attaches provenance automatically. No `NPM_TOKEN` and no `.npmrc` token line.
  7. **Verify:** `npm view arcanum-cli@<tag> version` returns the tag, retried for up to a minute. It also prints the published `dist.integrity`.
- **`--dry-run`** maps step 6 to `npm publish --dry-run` and skips steps 2 and 7. A Makefile target (e.g. `cli-publish-dry-run`) runs it locally in the `cli` compose service.
- **Tooling floor.** Trusted publishing needs npm ≥ 11.5.1 and Node ≥ 22.14.0. The job checks both before publishing. If the image's npm is older, it upgrades to an exact pinned npm version in the job, or the job moves to a newer image.
- **Bootstrap (one-time, manual, documented).** npm only lets a trusted publisher be registered on an existing package. So the package owner:
  1. runs the dry run;
  2. publishes the first version by hand from a clean checkout of the release tag;
  3. registers the CircleCI trusted publisher for `arcanum-cli`, either on npmjs.com or with `npm trust` (`--vcs-origin` for `darthjee/arcanum`, optionally `--context-id`);
  4. disallows token publishing on the package.

  After that, the job is fully automatic. Until it is done, a `publish-cli` run fails at step 6 with npm's auth error, and a re-run after the bootstrap succeeds or no-ops at step 2.
- **Failure handling** follows the spec: `build-and-release` runs first, a failed publish is recovered with "Rerun workflow from failed", a re-run after a successful publish is a no-op, and a broken version is never unpublished but deprecated and superseded.

## Solution
- **`scripts/publish_cli_package.sh`.** Model it on `scripts/publish_runtime_image.sh`: `set -euo pipefail`, no `set -x`, the step order above and the `--dry-run` flag. It is testable by putting a fake `npm` on `PATH`, as the root `scripts/test_*.sh` scripts do. Add a `scripts/test_publish_cli_package.sh` that covers: version mismatch, a non-bare tag, the already-published short-circuit, the dry run, a wrong pack file list and verify retries.
- **`.circleci/config.yml`.** Add the `publish-cli` job and its `release` workflow entry. Update the header comment: describe `publish-cli` next to `publish-image`, and note that it uses OIDC trusted publishing, so no `NPM_TOKEN` is needed.
- **Makefile.** Add the dry-run target next to the existing `cli-*` targets.
- **Docs:**
  - `docs/agents/architecture/install-and-release.md`: the `publish-cli` job, the one-time bootstrap and the failure and recovery steps.
  - `docs/agents/specs/arcanum-cli/packaging-and-release.md`: update **Token storage**, **Provenance** and **Open points** to the trusted-publishing decision, and drop or adjust the `NPM_TOKEN` mentions under Supply chain, Edge cases and Security.
  - `docs/agents/architecture/agent-roster-and-delegation.md`: replace the `NPM_TOKEN setup` mention in `infra`'s scope with the trusted-publisher setup.

## Benefits
- `npm i -g arcanum-cli` works, and its version always matches the latest arcanum release.
- There is no long-lived npm secret to store, leak or rotate.
- Published tarballs carry npm provenance, which links each version to the exact CircleCI build that produced it.
- Re-runs are safe, and every published artefact is the one that was just tested.
