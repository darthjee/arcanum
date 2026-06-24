# Plan: Add a proper script / skill for responding comments

Issue: [50-add-a-proper-script---skill-for-responding-comments-.md](../issues/50-add-a-proper-script---skill-for-responding-comments-.md)

## Overview

Today `auto-fix-all/steps/handle_comment.md` always dispatches a PR comment into the code-change-and-commit flow, even when the comment is just a question. We add a script+template pair (mirroring `discuss-issue/templates/issue.tmpl.md` + `discuss-issue/scripts/render_issue.sh`) that posts an attributed reply comment on the PR, and update `handle_comment.md` with a judgment step that routes question/clarification comments to this new reply path instead of the dispatch-and-commit flow.

## Agents involved

- [scripter](scripter.md)
- [architect](architect.md)

## Shared contracts

A new script `auto-fix-all/scripts/reply_comment.sh` (built by scripter) with this contract:

```
reply_comment.sh <id> <agent> <model_name> <model_email> <reply_body>
```

- `<id>`: numeric GitHub issue id of the currently checked-out `issue-<id>` branch. Used only to resolve the PR via `../auto-monitor-issue-pr/scripts/resolve_pr_number.sh <id>` (resolved relative to the `auto-fix-all` skill folder) — that script reads the current branch itself, no other lookup is needed.
- `<agent>`: the name of the agent posting the reply (e.g. `architect`, `scripter`, or any specialist agent name as reported by `list_agents.sh`).
- `<model_name>` / `<model_email>`: the AI model name and noreply email used by the calling agent (same values already passed to `commit_change.sh`).
- `<reply_body>`: the full text of the reply to post.
- Behavior: renders `auto-fix-all/templates/reply.tmpl.md` (new template, alongside the script) substituting the reply body and an attribution line, then posts it via `gh pr comment <pr_number> --body-file -` (or equivalent), resolving the repo the same way `resolve_pr_number.sh` / `_lib_origin.sh` already do (the script sources its own `_lib_origin.sh` copy already present in `auto-fix-all/scripts/`).
- Exit code 0 on success, non-zero with an `Usage:`/error message on stderr for bad args or `gh` failures (no internal retry loop needed — `handle_comment.md` only calls this once per question comment, while still inside the same monitoring iteration).
- The template's attribution line format mirrors `commit_change.sh`'s `Co-Authored-By:` trailer but adapted for a PR comment body, e.g.:
  ```
  _Replied by: <agent> agent (<model_name> <model_email>)_
  ```
  placed after the reply body.

`architect` consumes this script's contract (name, args, exit behavior) when wiring the new judgment step into `handle_comment.md` — no other interface crosses the boundary.

## Implementation Steps

See [scripter.md](scripter.md) and [architect.md](architect.md) for the per-agent breakdown. At a high level:

1. scripter creates `auto-fix-all/templates/reply.tmpl.md` and `auto-fix-all/scripts/reply_comment.sh`.
2. architect updates `auto-fix-all/steps/handle_comment.md` to add the question-vs-actionable judgment step and wire in the new script.

## Files to Change

- `auto-fix-all/templates/reply.tmpl.md` — new reply template (scripter)
- `auto-fix-all/scripts/reply_comment.sh` — new script posting the reply (scripter)
- `auto-fix-all/steps/handle_comment.md` — new judgment step + dispatch to the reply script (architect)

## Notes

- No CI config applies to this repo (markdown/scripts only, no test suite found) — `## CI Checks` omitted.
- The reply script intentionally takes the issue id (not the PR number directly) to mirror how `handle_comment.md` is always invoked — already inside a checked-out `issue-<id>` branch — and to reuse `resolve_pr_number.sh` exactly as the issue requested.
