# Issue: Codacy: shellcheck SC2016 — arcanum/_lib/spawn_issue.sh (1 finding)

## Description

ShellCheck SC2016 ("Expressions don't expand in single quotes") was reported at `arcanum/_lib/spawn_issue.sh:180`. The flagged line is the single-quoted GraphQL `addSubIssue` mutation passed to `gh api graphql`. Its `$issueId` / `$subIssueId` tokens are **GraphQL variables** that the shell must not expand, so the finding is a false positive. Severity **Warning**.

**Source:** a Codacy API snapshot taken at commit `5499394` (2026-08-17, issue #174). Tool **ShellCheck**, pattern `shellcheck_SC2016`, category BestPractice.

## Problem

The Codacy snapshot is stale relative to `main`:

- #250 migrated spawn-issue to the engine-dispatch pattern. `arcanum/_lib/spawn_issue.sh` is now a 39-line shim, and the flagged logic moved to `arcanum/_lib/spawn_issue_shell.sh` (the mutation is now at line 183).
- #489 already added `# shellcheck disable=SC2016` directly above that line (`spawn_issue_shell.sh:182`).
- The native counterpart (`core/lib/utils/issue/IssueLinker.js`) holds the mutation as a JS string constant and is not subject to ShellCheck.
- Running `shellcheck` locally on both `spawn_issue.sh` and `spawn_issue_shell.sh` reports zero findings.

## Expected Behavior

- Codacy reports zero `shellcheck_SC2016` findings for `arcanum/_lib/spawn_issue.sh` and `arcanum/_lib/spawn_issue_shell.sh`.
- No script behavior changes.

## Solution

No code change is required. Confirm on Codacy's current analysis of `main` that the finding is gone, then close this issue as already fixed by #489 (with #250 as the relocation). If Codacy still reports it against current `main`, the fallback is to check whether Codacy honors inline `# shellcheck disable` directives. If it doesn't, move the mutation into a named variable declared on its own line, together with the directive. Owner: `scripter` agent (only if a change turns out to be needed).
