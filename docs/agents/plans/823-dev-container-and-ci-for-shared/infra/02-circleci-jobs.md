# CircleCI shared and shared-node-floor jobs

Gate `shared/` in the `test` workflow.

- `shared` job: image `darthjee/circleci_node:0.2.1`, `working_directory: ~/project/shared`, `checkout: path: ~/project`; steps `yarn install --frozen-lockfile`, `yarn lint`, `yarn test` (blocking — c8 enforces thresholds), the Codacy partial upload from step 03, then `yarn audit || true` ("Dependency audit (non-blocking)").
- `shared-node-floor` job: image `cimg/node:22.13.0`, same working dir/checkout; steps install and `yarn test` only (no lint, no upload), like `cli-node-floor`.
- Add both to `workflows.test.jobs` with `filters: tags: ignore: /.*/`; no path filters.
- Header comment: add a paragraph on the `shared` jobs (why the floor job exists: the CLI ships this code to users on Node 22.13).

## Files to Change
- `.circleci/config.yml` — `shared` and `shared-node-floor` jobs, workflow entries, header comment
