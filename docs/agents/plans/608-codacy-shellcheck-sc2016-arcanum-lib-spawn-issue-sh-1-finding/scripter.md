# Plan: Codacy: shellcheck SC2016 — arcanum/_lib/spawn_issue.sh (1 finding)

Issue: [608-codacy-shellcheck-sc2016-arcanum-lib-spawn-issue-sh-1-finding.md](../../issues/608-codacy-shellcheck-sc2016-arcanum-lib-spawn-issue-sh-1-finding.md)

## Overview
The reported finding (`arcanum/_lib/spawn_issue.sh:180`) comes from a Codacy snapshot at commit `5499394` (2026-08-17), which predates both the spawn-issue engine-dispatch migration (#250) and the SC2016 cleanup (#489). On current `main` the flagged `addSubIssue` GraphQL mutation lives at `arcanum/_lib/spawn_issue_shell.sh:183`, already preceded by `# shellcheck disable=SC2016` on line 182, and local `shellcheck` reports zero findings. The expected outcome is no code change.

## Context
- `spawn_issue.sh` is now a 39-line `engine_dispatch` shim with no single-quoted `$` expressions.
- `spawn_issue_shell.sh:182-183` holds the directive + mutation; the `$issueId`/`$subIssueId` tokens are GraphQL variables and must stay unexpanded.
- The native counterpart `core/lib/utils/issue/IssueLinker.js` keeps the mutation as a JS constant and is outside ShellCheck's scope.

## Implementation Steps

### Step 1 — Verify the finding is gone
Run `shellcheck arcanum/_lib/spawn_issue.sh arcanum/_lib/spawn_issue_shell.sh` and confirm zero findings. Check Codacy's current analysis of `main` (Codacy MCP/API or dashboard) for any `shellcheck_SC2016` issue on either file. If none is reported, make no code change — the PR only carries the issue/plan docs and closes #608 as already fixed by #489.

### Step 2 — Fallback (only if Codacy still reports SC2016 on current `main`)
Codacy may not honour a directive placed above a compound `if`. Extract the mutation into a named local declared on its own line, directly preceded by the directive, and pass that variable to `gh api graphql -f query="$mutation"`:

```bash
# shellcheck disable=SC2016  # $issueId/$subIssueId are GraphQL variables, not shell
local mutation='mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(input:{issueId:$issueId,subIssueId:$subIssueId}){subIssue{id}}}'
```

(Use a plain assignment instead of `local` if the block is not inside a function.) Behaviour must stay byte-identical.

## Files to Change
- None expected.
- Fallback only: `arcanum/_lib/spawn_issue_shell.sh` — move the mutation into a named variable with the SC2016 directive on the line above it.

## CI Checks
- `core`: `cd core && yarn test` (CI job running `yarn test`) — `core/spec/bin/spawnIssueParity_spec.js` must still pass if the fallback is applied.
- ShellCheck is not part of CircleCI; run `shellcheck` locally on the touched script(s).

## Notes
- The Codacy MCP server timed out during issue discussion, so the live Codacy state was not verified yet — Step 1 must do it.
- If Step 1 confirms no finding, closing #608 as a duplicate of #489 is an acceptable outcome.
