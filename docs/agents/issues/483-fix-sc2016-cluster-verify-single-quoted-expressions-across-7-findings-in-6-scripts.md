# Issue: Fix SC2016 cluster: verify single-quoted expressions across 6 findings in 5 scripts

## Description
Codacy's ShellCheck flags 6 SC2016 findings ("Expressions don't expand in single quotes, use double quotes for that.") across 5 files:

- `auto-monitor-pr/scripts/monitor_pr_shell.sh:109` — `` gh api graphql -f query='mutation($id:ID!,$content:ReactionContent!){addReaction(input:{subjectId:$id,content:$content}){reaction{id}}}' -F id="$1" -F content="$2" ``
- `auto-monitor-pr/scripts/monitor_pr_shell.sh:113` — `` gh api graphql -f query='mutation($id:ID!,$content:ReactionContent!){removeReaction(input:{subjectId:$id,content:$content}){subject{id}}}' -F id="$1" -F content="$2" ``
- `arcanum/_lib/spawn_issue_shell.sh:181` — `` gh api graphql -f query='mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(input:{issueId:$issueId,subIssueId:$subIssueId}){subIssue{id}}}' -F issueId="$parent_node_id" -F subIssueId="$sub_node_id" ``
- `scripts/generate_tags_table.sh:369` — `` printf '| %s | %s | `%s` | %s | %s |\n' "$skill" "$step_display" "$entrypoint" "$added" "$removed" ``
- `scripts/generate_entrypoint_migration_status.sh:86` — `` printf '| `%s` | %s | %s |\n' "$key" "$migrated" "$issue_display" ``
- `core/docker-entrypoint.sh:32` — `exec su node -s /bin/sh -c 'exec "$0" "$@"' -- "$@"`

Note: the original Codacy scan also flagged `arcanum/_lib/spawn_issue.sh:180` with the same GraphQL mutation, but that file was migrated to a thin native-dispatch shim in #239 (commit `41d7154`) and no longer contains that code — it's dropped from scope here as stale.

## Problem
ShellCheck can't distinguish "single-quoted because the `$name` inside is meant to stay literal" from "single-quoted by mistake, where `$name` was meant to expand in the *outer* shell." Two different real shapes exist here and need different treatment:

- The `gh api graphql -f query='...$id...'` and `printf '...%s...'` cases use single quotes deliberately: the `$id`, `$content`, `$issueId`, `$subIssueId` tokens are GraphQL variable placeholders (resolved server-side via `-F`), not shell variables, and the `printf` format strings' literal `%s`/backtick text must not be shell-expanded. Flipping these to double quotes would very likely break them by letting the shell try to expand `$id`/`$content`/etc. before `gh`/`printf` ever sees the string.
- `core/docker-entrypoint.sh:32`'s `su node -s /bin/sh -c 'exec "$0" "$@"'` is the same shape: `$0`/`$@` are meant to expand inside the `su`'d subshell, not the outer script, so single-quoting is correct there too.

In other words, all 6 are likely correct-as-written, but that needs confirming individually rather than assumed, and — per the repo's own convention from the SC2034 sweep (#464/#472-475) — a verified false positive should get a documented `# shellcheck disable=SC2016` suppression rather than being left to reappear in every future Codacy scan.

## Expected Behavior
- Each of the 6 locations above is individually verified: either the single-quoting is confirmed intentional (variable meant to be delayed/literal), or it's a genuine bug and gets fixed to double-quote.
- Confirmed-intentional occurrences get a `# shellcheck disable=SC2016` comment naming why (e.g. "GraphQL variable, not a shell variable" or "meant to expand inside the su'd subshell").
- No script's actual behavior changes as a result of this issue (unless a genuine bug is found).

## Solution
For each `file:line` above:
1. Confirm whether the token(s) inside single quotes are consumed by something other than the outer shell (GraphQL server, a nested `su`/`sh -c` subshell) or are literal format-string text.
2. If confirmed intentional: add `# shellcheck disable=SC2016` on the line above, with a short comment explaining why (e.g. `# GraphQL variables, resolved server-side via -F, not shell variables`).
3. If not — i.e. the value really was meant to come from the outer shell — fix the quoting and verify the script's behavior is unchanged.

Delegate by file:
- `scripter`: `auto-monitor-pr/scripts/monitor_pr_shell.sh`, `arcanum/_lib/spawn_issue_shell.sh`, `scripts/generate_tags_table.sh`, `scripts/generate_entrypoint_migration_status.sh` (all under `<skill>/scripts/` or `arcanum/_lib/`).
- `infra`: `core/docker-entrypoint.sh` (Docker entrypoint for `core/`'s test image — see `core/Dockerfile`).

## Benefits
- Clears 6 of the repo's outstanding Codacy/ShellCheck SC2016 Warnings.
- Documents, at each call site, why the single-quoting is safe — preventing a future contributor from "fixing" it into an actual bug.
