# Plan: CircleCI npm publish job for arcanum-cli

Issue: [783-circleci-npm-publish-job-for-arcanum-cli.md](../../issues/783-circleci-npm-publish-job-for-arcanum-cli.md)

## Overview
Publish `arcanum-cli` to npm on every arcanum release tag. A new `publish-cli` job in the CircleCI `release` workflow calls `scripts/publish_cli_package.sh <tag>`, which checks, builds, tests, verifies the package contents, publishes with npm trusted publishing (OIDC, with provenance, no stored token), then verifies the published version. The release docs and the CLI packaging spec are updated to match.

See [infra.md](infra.md) for the full plan.
