# Plan: Fix Tag Fetching Script

Issue: [84-fix-tag-fetching-script.md](../issues/84-fix-tag-fetching-script.md)

## Overview

Suppress the non-zero exit that `grep` emits when no `:tag:` patterns are found in `_lib/tags.sh`'s `extract_tags` function. Under `set -euo pipefail`, used by all callers, a `grep` that finds no matches exits 1 and aborts the caller. Adding `|| true` at the end of the extraction pipeline makes the function return 0 (empty output) when no tags are present — the correct behavior.

## Context

`extract_tags` in `_lib/tags.sh` pipes through `grep -oE ':[A-Za-z0-9_+]+:'`. When the input contains no `:word:` tokens, `grep` returns exit code 1 (POSIX behavior for "no match"). Callers (`_lib/github_issue.sh` line ~151, `monitor-issues/scripts/monitor_issues.sh` line ~129) invoke this function inside a pipeline, so the non-zero exit propagates via `pipefail`, causing the script to abort whenever it processes an issue with no tags.

## Implementation Steps

### Step 1 — Add `|| true` to the `extract_tags` pipeline

In `_lib/tags.sh`, change the extraction line inside `extract_tags` from:

```bash
echo "$normalized" | grep -oE ':[A-Za-z0-9_+]+:' | sed 's/^://;s/:$//' | awk '!seen[$0]++'
```

to:

```bash
echo "$normalized" | grep -oE ':[A-Za-z0-9_+]+:' | sed 's/^://;s/:$//' | awk '!seen[$0]++' || true
```

`|| true` ensures the overall pipeline always exits 0. Placing it at the very end (after `awk`) is the correct location — inserting it in the middle (e.g. `grep ... || true | sed ...`) would break operator precedence and prevent `grep`'s output from being piped into `sed`.

## Files to Change

- `_lib/tags.sh` — add `|| true` at the end of the extraction pipeline in `extract_tags`

## Notes

- No callers need to change; they already handle empty output correctly.
- `sed` and `awk` in this pipeline are simple transforms with no failure mode, so suppressing their exit codes via `|| true` is safe.
