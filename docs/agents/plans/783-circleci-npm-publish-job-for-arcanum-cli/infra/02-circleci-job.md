# CircleCI publish-cli job
- **The job.** Add `publish-cli` to `.circleci/config.yml`'s `jobs:`:
  - `docker: - image: darthjee/circleci_node:0.2.1` and `working_directory: ~/project/cli`, with `checkout: path: ~/project`, as in the `cli` job;
  - a step that ensures npm ≥ 11.5.1: print `node --version` and `npm --version`, and run `npm install -g npm@<exact 11.x>` only when the bundled npm is older. If the image's global prefix is not writable, use `sudo` or a user prefix, whichever the image supports;
  - a single step that runs `../scripts/publish_cli_package.sh "$CIRCLE_TAG"`.

  Do not attach any context that holds npm secrets. CircleCI injects its OIDC token into every job.
- **The workflow.** Add it to `workflows.release.jobs` with `requires: [build-and-release]` and the same `branches: ignore: /.*/` and `tags: only: /^\d+\.\d+\.\d+$/` filters as `publish-image`, so the two run in parallel.
- **The header comment.**
  - Add a paragraph for `publish-cli` next to `publish-image`. It should say that it publishes `arcanum-cli@<tag>` with npm trusted publishing (CircleCI OIDC, with provenance), that no npm token env var is needed or allowed, that re-runs after a successful publish are no-ops, and that the trusted publisher must be registered once (link to `docs/agents/architecture/install-and-release.md`).
  - Fix the stale `../core/lib` mention in the `cli` paragraph: it is `../shared/lib`.

## Files to Change
- `.circleci/config.yml` — the `publish-cli` job, its `release` workflow entry and the header comment.
