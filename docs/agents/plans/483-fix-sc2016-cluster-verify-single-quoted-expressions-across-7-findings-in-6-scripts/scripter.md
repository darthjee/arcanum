# Scripter Plan: Fix SC2016 cluster: verify single-quoted expressions across 6 findings in 5 scripts

Main plan: [plan.md](plan.md)

## Shared contracts

None — this agent's work is fully independent of `infra`'s.

## Implementation Steps

### Step 1 — Verify and annotate the GraphQL/printf findings
For each location below, confirm the token(s) inside the single-quoted string are consumed by something other than the outer shell (the GraphQL server via `-F`, in the `gh api graphql` cases) or are literal `printf` format-string text — not a shell variable that was meant to expand before the command runs. All 4 are expected to confirm as intentional based on the issue's analysis, but verify each individually rather than assuming.

- If confirmed intentional, add a `# shellcheck disable=SC2016` comment on the line above the flagged line, naming why (e.g. `# GraphQL variables, resolved server-side via -F, not shell variables` or `# Literal printf format string, not a shell expansion`).
- If any turns out to be a genuine bug (the value really was meant to come from the outer shell), fix the quoting instead and verify the script's behavior is unchanged (re-run/trace the call site; these are all used inside larger scripts with existing test/usage coverage — check for and run any existing spec/test for the file before and after).

## Files to Change
- `auto-monitor-pr/scripts/monitor_pr_shell.sh:109` — `add_reaction()`'s `gh api graphql -f query='mutation($id:ID!,$content:ReactionContent!){addReaction(...)}' -F id="$1" -F content="$2"`; add disable comment (GraphQL variables).
- `auto-monitor-pr/scripts/monitor_pr_shell.sh:113` — `remove_reaction()`'s equivalent `removeReaction` mutation; same treatment.
- `arcanum/_lib/spawn_issue_shell.sh:181` — `gh api graphql -f query='mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(...)}' -F issueId="$parent_node_id" -F subIssueId="$sub_node_id"`; add disable comment (GraphQL variables).
- `scripts/generate_tags_table.sh:369` — `printf '| %s | %s | \`%s\` | %s | %s |\n' "$skill" "$step_display" "$entrypoint" "$added" "$removed"`; add disable comment (literal format string).
- `scripts/generate_entrypoint_migration_status.sh:86` — `printf '| \`%s\` | %s | %s |\n' "$key" "$migrated" "$issue_display"`; add disable comment (literal format string).

## Notes
- Do not touch `arcanum/_lib/spawn_issue.sh` — the finding originally reported at line 180 of that file is stale: the file was migrated to a thin native-dispatch shim in #239 and no longer contains this code. Only `spawn_issue_shell.sh` needs the annotation.
- No script's actual behavior should change as a result of this work, unless verification finds a genuine bug.
