# Plan: Fix SC2034 LOCK_FILE cluster: verify unused vs. sourced across 10 scripts

Issue: [472_fix-sc2034-lock-file-cluster-verify-unused-vs-sourced-across-10-scripts.md](../../issues/472-fix-sc2034-lock-file-cluster-verify-unused-vs-sourced-across-10-scripts.md)

## Overview

Investigation (done as part of this plan) shows all 10 `LOCK_FILE` assignments are genuinely consumed — none are dead code. Each file sources `arcanum/_lib/lock.sh` (directly, or transitively via `queue_common.sh`), whose `_acquire_lock`/`_release_lock` functions read `$LOCK_FILE`. ShellCheck analyzes each file in isolation and never follows that cross-file read, so it flags the assignment as unused in every one of the 10 files. The fix is a suppression comment naming the real consumer, not a deletion, in all 10 cases.

See [scripter.md](scripter.md) for the full plan.
