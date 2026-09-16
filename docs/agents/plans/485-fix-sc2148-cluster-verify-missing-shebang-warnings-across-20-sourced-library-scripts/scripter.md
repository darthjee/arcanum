# Plan: Fix SC2148 cluster: verify missing-shebang warnings across 20 sourced library scripts

Issue: [485_fix-sc2148-cluster-verify-missing-shebang-warnings-across-20-sourced-library-scripts.md](../../issues/485-fix-sc2148-cluster-verify-missing-shebang-warnings-across-20-sourced-library-scripts.md)

## Overview
20 files under `arcanum/_lib/`, `arcanum/migrations/`, and `init-claude/scripts/lib/` are missing line-1 shebangs/shell directives, triggering SC2148. During discussion, 19 were confirmed source-only (safe for a `# shellcheck shell=bash` directive) and one (`arcanum/_lib/permission_grant.sh`) was confirmed direct-executed and needs a real shebang instead.

## Context
- ShellCheck analyzes each file in isolation and can't infer these are libraries meant to be `source`d by an entrypoint that already carries its own shebang.
- `arcanum/_lib/permission_grant.sh` is directly executed (no `source`/`.` prefix) from `init-claude/setup_permissions.md`'s bash fences, and its own code already carries a `[[ "${BASH_SOURCE[0]}" == "$0" ]]` dual-mode dispatcher expecting to run directly — it is the one real exception.
- 9 of the 19 source-only files have their executable bit set despite never being invoked directly. This is harmless, isn't flagged by SC2148, and is explicitly out of scope for this issue — leave those bits untouched.
- No existing precedent for `# shellcheck shell=bash` exists yet in this repo; this issue establishes it.

## Implementation Steps

### Step 1 — Add `# shellcheck shell=bash` to the 19 source-only files
For each of the following files, re-confirm (grep its basename across the repo, including skill `steps/*.md` bash fences) that every call site sources it (`source`/`.`, or sourced by another file) with no direct-execution call site, then add `# shellcheck shell=bash` as the file's first line:

- `arcanum/_lib/permission_grant_shell.sh`
- `arcanum/_lib/tags.sh`
- `arcanum/_lib/merge_body.sh`
- `arcanum/_lib/agent_email.sh`
- `arcanum/_lib/config_chain.sh`
- `arcanum/_lib/tag_actions.sh`
- `arcanum/_lib/origin.sh`
- `arcanum/_lib/global_config.sh`
- `arcanum/_lib/safe_branch.sh`
- `arcanum/_lib/push.sh`
- `arcanum/_lib/commit_template.sh`
- `arcanum/_lib/tag_mutate.sh`
- `arcanum/_lib/git_branch.sh`
- `arcanum/_lib/lock.sh`
- `arcanum/_lib/repo_config.sh`
- `arcanum/migrations/_ledger.sh`
- `arcanum/migrations/_pending_versions.sh`
- `arcanum/migrations/_manifest.sh`
- `init-claude/scripts/lib/label_config.sh`

Do not change executable bits or any other line in these files.

### Step 2 — Add a real shebang to `permission_grant.sh`
Re-confirm `arcanum/_lib/permission_grant.sh` is still directly executed from `init-claude/setup_permissions.md` (and any other caller found via grep), then add `#!/usr/bin/env bash` as its first line instead of the shellcheck directive used in Step 1. Its executable bit is already correctly set — leave it as-is.

## Files to Change
- `arcanum/_lib/permission_grant_shell.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/permission_grant.sh` — add `#!/usr/bin/env bash` at line 1
- `arcanum/_lib/tags.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/merge_body.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/agent_email.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/config_chain.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/tag_actions.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/origin.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/global_config.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/safe_branch.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/push.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/commit_template.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/tag_mutate.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/git_branch.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/lock.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/_lib/repo_config.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/migrations/_ledger.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/migrations/_pending_versions.sh` — add `# shellcheck shell=bash` at line 1
- `arcanum/migrations/_manifest.sh` — add `# shellcheck shell=bash` at line 1
- `init-claude/scripts/lib/label_config.sh` — add `# shellcheck shell=bash` at line 1

## Notes
- Comment/shebang-only changes; no behavior, permission, or invocation-path changes expected.
- Verify locally with `shellcheck <file>` (and `shellcheck -x` where cross-file reads matter) before/after on each of the 20 files, plus `bash -n` syntax checks, to confirm SC2148 clears and nothing else regresses.
- If re-verification in Step 1 or 2 turns up a changed caller (e.g. a new direct-execution call site added since discussion), treat that file like `permission_grant.sh` (real shebang) instead of applying the directive.
