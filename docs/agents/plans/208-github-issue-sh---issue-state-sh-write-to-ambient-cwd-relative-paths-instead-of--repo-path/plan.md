# Plan: github_issue.sh / issue_state.sh write to ambient-cwd-relative paths instead of $repo_path

Issue: [208-github-issue-sh---issue-state-sh-write-to-ambient-cwd-relative-paths-instead-of--repo-path.md](../../issues/208-github-issue-sh---issue-state-sh-write-to-ambient-cwd-relative-paths-instead-of--repo-path.md)

## Overview

Make `arcanum/_lib/github_issue.sh` (`cmd_fetch`/`cmd_create`), `arcanum/_lib/issue_state.sh`, and `arcanum/_lib/list_agents.sh` resolve their file paths against an explicit `repo_path` instead of the ambient shell cwd, by adopting the repo's existing `repo_path_enter` convention (`arcanum/_lib/repo_path.sh`). `issue_state.sh` and `list_agents.sh` currently take no `repo_path` parameter at all, so giving them one is a **breaking signature change** — every call site across the skills tree must be updated in this same change for the branch to stay in a working state (a script and a follow-up correction to it cannot be merged as two separate PRs without leaving `main` broken in between). This is why the plan below is larger than the issue's original "leaf scripts only" framing discussed with the user: that framing under-estimated how many callers a signature change touches. See Notes.

## Agents involved

- [scripter](scripter.md) — `arcanum/_lib/*.sh` changes and every `*/scripts/*.sh` caller
- [skill-writer](skill-writer.md) — every `steps/*.md` doc that documents/invokes these calls in prose

## Shared contracts

New required leading positional argument on two scripts (matches the existing convention already used by e.g. `checkout_from_main.sh <repo_path> <id>`):

- `arcanum/_lib/issue_state.sh <repo_path> <get|set|set-json|append-json> <id> <field> [value]`
  (shifts today's `COMMAND ISSUE_ID FIELD [VALUE]` right by one position)
- `arcanum/_lib/list_agents.sh <repo_path> [agents_dir]`
  (`agents_dir` remains optional, still defaulting to `.claude/agents`, now resolved against `repo_path` after `repo_path_enter` cd's there)

`arcanum/_lib/github_issue.sh fetch|create <repo_path> ...` keeps its existing signature (it already takes `repo_path` first) — only its internal behavior changes.

Every wrapper script that is a pure `exec ... "$@"` pass-through (`discuss-issue/scripts/list_agents.sh`, `plan-issue/scripts/list_agents.sh`, `auto-plan-issue/scripts/list_agents.sh`, `auto-fix-issue/scripts/issue_state.sh`) needs **no changes of its own** — only the callers that invoke them need updating to pass `repo_path` as the new leading argument.

## Notes

- The issue as discussed with the user assumed the three leaf scripts could be fixed on their own, with all call-site updates deferred to follow-up sub-issue [#212](https://github.com/darthjee/arcanum/issues/212). That's only true for `github_issue.sh` (its signature doesn't change). For `issue_state.sh`/`list_agents.sh`, adding a required leading `repo_path` argument breaks **every existing call site** immediately (confirmed by inspection — none currently pass a leading path arg), so this plan folds the full caller sweep in here instead, to keep the branch mergeable at every step. Issue #212 should be revisited (comment/close as superseded) once this lands, since its remaining scope is effectively covered here — flag this to the user/architect when this plan is picked up for implementation, don't act on #212 unilaterally.
- No CI job exercises these scripts (`.circleci/config.yml` only runs `core/`'s `yarn test`/`yarn lint`), and no existing automated test does either — manual verification (see each agent's plan) is the only check available today.
