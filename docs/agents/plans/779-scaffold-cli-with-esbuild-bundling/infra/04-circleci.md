# CircleCI cli and floor jobs

In `.circleci/config.yml`, per [Shared Config Logic → CI coupling](../../../specs/arcanum-cli/shared-config-logic.md#ci-coupling) and the [index's Runtime](../../../specs/arcanum-cli.md#runtime):

- **`cli` job:**
  - image `darthjee/circleci_node:0.2.1`;
  - full-repo `checkout` with `working_directory: ~/project/cli`;
  - steps: `yarn install --frozen-lockfile`, `yarn lint`, `yarn build`, `yarn test`, then a non-blocking `yarn audit`, like `checks`.
- **`cli-node-floor` job:**
  - image `cimg/node:22.13.0`;
  - same checkout and working directory;
  - steps: `yarn install --frozen-lockfile`, `yarn build`, `yarn test`.
- **Workflow:** add both to `workflows.test` next to `test`/`checks`/`mod-checks`, with `filters: tags: ignore: /.*/`, no `requires` and no path filters. Add a header comment block for them, like the one for `mod-checks`.

Confirm both jobs are green on the branch once pushed.

## Files to Change

- `.circleci/config.yml` — `cli` and `cli-node-floor` jobs and their workflow entries.
