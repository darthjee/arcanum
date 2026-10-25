# Plan: publish-cli job fails after a successful publish when registry verify times out

Issue: [858-publish-cli-job-fails-after-a-successful-publish-when-registry-verify-times-out.md](../../issues/858-publish-cli-job-fails-after-a-successful-publish-when-registry-verify-times-out.md)

## Overview
Make the post-publish verify step of `scripts/publish_cli_package.sh` non-fatal and longer, so a release whose `npm publish` succeeded never fails the `publish-cli` job because of registry lag.

## Context
The 2.2.3 release published `arcanum-cli@2.2.3`, but the verify loop (`VERIFY_TIMEOUT=60`, `VERIFY_INTERVAL=5`) timed out and exited 1. npm warns that a new version may take a few minutes to become visible. The root `scripts/` folder has no listed specialist owner, and `docs/agents/architecture/` belongs to the architect, so this plan has no specialist split.

## Implementation Steps

### Step 1 — Make the verify step tolerant of registry lag
In `scripts/publish_cli_package.sh`:
- Set `VERIFY_TIMEOUT=300`.
- On timeout, print to stderr `Warning: arcanum-cli@<tag> was published but is not visible after <N>s (registry lag); check it later with: npm view arcanum-cli@<tag> version` and `exit 0` instead of `exit 1`.
- Update the header: "each step fails the script on error, except step 7", and note under step 7 that a timeout only warns.

Nothing before or during `npm publish` changes; `set -euo pipefail` still fails the job on any earlier error.

### Step 2 — Update the release architecture doc
In `docs/agents/architecture/install-and-release.md`, rewrite the "Registry lag" bullet under "Failure and recovery": the verify polls for up to five minutes, then warns and the job still succeeds; check later with `npm view arcanum-cli@X.Y.Z version`.

## Files to Change
- `scripts/publish_cli_package.sh` — longer timeout, non-fatal timeout, header comments.
- `docs/agents/architecture/install-and-release.md` — "Registry lag" recovery bullet.

## CI Checks
- No CI job runs this script outside the `release` workflow's `publish-cli` job. Locally: `bash -n scripts/publish_cli_package.sh`, plus the verify loop run with a stubbed `npm` on `PATH` that never returns the version and a short timeout (expect exit 0 with the warning).

## Notes
- PR #859 (branch `fix-cli-publish-verify-timeout`) already implements exactly these two steps.
- The real confirmation is the next release run.
