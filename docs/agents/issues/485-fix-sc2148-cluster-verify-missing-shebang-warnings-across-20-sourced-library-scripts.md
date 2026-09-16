# Issue: Fix SC2148 cluster: verify missing-shebang warnings across 20 sourced library scripts

## Description
Codacy's ShellCheck flags SC2148 ("Tips depend on target shell and yours is unknown. Add a shebang or a 'shell' directive.") at line 1 of 20 files, all under `arcanum/_lib/`, `arcanum/migrations/`, and `init-claude/scripts/lib/`:

- `arcanum/_lib/permission_grant_shell.sh`
- `arcanum/_lib/permission_grant.sh`
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

## Problem
This mirrors the exact shape already handled for SC2034 in #464/#472-475: ShellCheck analyzes each file in isolation and doesn't know these are `arcanum/_lib/`-style shared libraries meant to be `source`d by an entrypoint script (which already carries its own shebang), never executed directly — so a shebang genuinely isn't needed on most of them. But that needs confirming per file rather than assumed, since a naive blanket suppression would also hide a real future case where one of these files *is* meant to be directly executable and is missing a shebang by mistake.

That real case was confirmed during discussion: `arcanum/_lib/permission_grant.sh` is directly executed (not just sourced) from `init-claude/setup_permissions.md`'s bash fences (e.g. `../arcanum/_lib/permission_grant.sh "$REPO_PATH" add .claude/settings.json "..."`, no `source`/`.` prefix), and its own code already carries a `[[ "${BASH_SOURCE[0]}" == "$0" ]]` dual-mode dispatcher expecting to be run directly. It needs a real `#!/usr/bin/env bash` shebang, not the `# shellcheck shell=bash` directive applied to the other 19.

Separately, 9 of the 19 source-only files (`lock.sh`, `origin.sh`, `tags.sh`, `tag_actions.sh`, `tag_mutate.sh`, `repo_config.sh`, `permission_grant_shell.sh`, `migrations/_ledger.sh`, `migrations/_pending_versions.sh`, `migrations/_manifest.sh`) currently have their executable bit set despite never being invoked directly. This is harmless and out of scope for this issue — SC2148 doesn't flag it and it doesn't affect Expected Behavior below — so it's left untouched.

## Expected Behavior
- All 20 SC2148 findings below are resolved: 19 files via a `# shellcheck shell=bash` directive, and `permission_grant.sh` via a real shebang.
- No existing script behavior changes — invocation paths for all 20 files stay the same either way.
- Re-running ShellCheck/Codacy on the affected files shows zero SC2148 findings among these 20 locations.

## Solution
1. For the 19 confirmed source-only files (all except `permission_grant.sh`), suppress SC2148 with a `# shellcheck shell=bash` (or the correct target shell) directive at the top of the file instead of `disable=SC2148` — this also fixes ShellCheck's stated complaint ("target shell is unknown") rather than just silencing it, and gives ShellCheck the ability to fully analyze each file for its actual shell dialect.
2. For `arcanum/_lib/permission_grant.sh` — confirmed direct-executed from `init-claude/setup_permissions.md` — add a real `#!/usr/bin/env bash` shebang instead of the directive.
3. Re-verify each file's usage against the caller list already gathered during discussion before applying, per file, in case a caller changed between discussion and implementation — same spot-check approach used in #472/#473/#474.

Work should be delegated to the `scripter` agent, since all 20 files are under `arcanum/_lib/`, `arcanum/migrations/`, or `<skill>/scripts/`.

## Benefits
- Clears 20 of the repo's outstanding Codacy/ShellCheck Warnings — the single largest remaining cluster.
- A `# shellcheck shell=...` directive (rather than a bare disable) lets ShellCheck keep fully linting these files' actual shell dialect, unlike a blanket `disable=SC2148`.

