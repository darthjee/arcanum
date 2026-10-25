# Issue: publish-cli job fails after a successful publish when registry verify times out

## Description
The 2.2.3 release published `arcanum-cli@2.2.3` to npm (trusted publishing through `NPM_ID_TOKEN` works since #856), but the CircleCI `publish-cli` job still exited with status 1:

```
+ arcanum-cli@2.2.3
Verifying arcanum-cli@2.2.3 on the registry...
arcanum-cli@2.2.3 not visible after 60s (registry lag); re-run the verify
Exited with code exit status 1
```

## Problem
The post-publish verify loop in `scripts/publish_cli_package.sh` (`VERIFY_TIMEOUT=60`, `VERIFY_INTERVAL=5`) gives up after 60s and exits 1. npm itself warns that a new version "may take a few minutes to become available", so a successful release is reported as a failed job. `npm view arcanum-cli@2.2.3 version` returned `2.2.3` shortly afterwards.

## Expected Behavior
- When `npm publish` succeeds, the `publish-cli` job is green even if the registry is slow to show the version.
- A failing `npm publish`, or any earlier step, still fails the job.

## Solution
In `scripts/publish_cli_package.sh`:

- Raise `VERIFY_TIMEOUT` from 60s to 300s so normal registry propagation fits in the window.
- After `npm publish` has succeeded, a verify timeout prints a warning (published but not yet visible, with the `npm view` command to check later) and exits 0.
- Update the script header (step 7) and the "Registry lag" bullet in `docs/agents/architecture/install-and-release.md`.

Out of scope: the CircleCI job definition, the OIDC/`NPM_ID_TOKEN` auth, and `npm publish` itself. No migration is needed and no root-level folder is added.

Testing: `bash -n`, plus the verify loop run with a stubbed `npm` that never returns the version and a short timeout (expect exit 0 with the warning). The next release run confirms the job goes green.

## Benefits
Release pipelines report the real outcome: a successful publish no longer shows up as a failed job that needs a manual re-run.
