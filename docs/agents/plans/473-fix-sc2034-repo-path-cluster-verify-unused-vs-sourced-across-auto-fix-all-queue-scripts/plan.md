# Plan: Fix SC2034 REPO_PATH cluster: verify unused vs. sourced across auto-fix-all queue scripts

Issue: [473_fix-sc2034-repo-path-cluster-verify-unused-vs-sourced-across-auto-fix-all-queue-scripts.md](../../issues/473-fix-sc2034-repo-path-cluster-verify-unused-vs-sourced-across-auto-fix-all-queue-scripts.md)

## Overview

Clear the SC2034 ("appears unused") ShellCheck/Codacy finding on `REPO_PATH` in 5 `auto-fix-all` queue scripts by replacing the dead assignment with a `:` no-op that preserves the existing argument-validation/usage-message behavior. All work is under `auto-fix-all/scripts/`, so it is owned entirely by `scripter`.

See [scripter.md](scripter.md) for the full plan.
