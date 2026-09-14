# Plan: Fix SC2034 MIGRATIONS_SCRIPT_DIR cluster: verify unused vs. sourced across migrations scripts

Issue: [474-fix-sc2034-migrations-script-dir-cluster-verify-unused-vs-sourced-across-migrations-scripts.md](../../issues/474-fix-sc2034-migrations-script-dir-cluster-verify-unused-vs-sourced-across-migrations-scripts.md)

## Overview

Investigation during `discuss-issue` already confirmed that all 3 flagged `MIGRATIONS_SCRIPT_DIR` assignments under `arcanum/migrations/` are genuinely consumed cross-file by `_pending_versions.sh` — none are dead code. This is a single-owner fix: add a `# shellcheck disable=SC2034` suppression comment naming that consumer above each assignment, with no behavior change.

See [scripter.md](scripter.md) for the full plan.
