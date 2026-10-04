# Scripter Plan: auto-resolve-issue: run a single auto-fix-all loop for one issue

Main plan: [plan.md](plan.md)

## Shared contracts

- `process_one_issue.md` and `handle_comment.md` move from `auto-fix-all/steps/` to `auto-resolve-issue/steps/`.
- **No script moves, and no script's signature, arguments, output or behavior changes.** `auto-fix-all/templates/reply.tmpl.md` stays where it is, because `reply_comment_shell.sh` and `AutoFixAllReplyComment.js` read it from there.

## Implementation Steps

### Step 1 — Update the stale comment in wait_ci_and_merge_shell.sh
`auto-fix-all/scripts/wait_ci_and_merge_shell.sh` line ~18 says `(see auto-fix-all/steps/process_one_issue.md)`. Change it to `(see auto-resolve-issue/steps/process_one_issue.md)`. This is a comment-only change.

### Step 2 — Sweep scripts and Node sources for step-path mentions
Grep `auto-fix-all/scripts/`, `arcanum/_lib/`, `scripts/` and `core/lib/` (not specs, `node_modules` or `coverage`) for `auto-fix-all/steps/`, `process_one_issue` and `handle_comment`, and repoint any comment or doc-string mention to `auto-resolve-issue/steps/`. Do **not** touch the `reply.tmpl.md` resolution in `reply_comment_shell.sh` / `AutoFixAllReplyComment.js`. If a hit is functional (code reading a step file by path) rather than a comment, stop and flag it to the architect instead of changing it.

## Files to Change
- `auto-fix-all/scripts/wait_ci_and_merge_shell.sh` — comment points at the moved step
- (any other comment-only hits found in Step 2)

## CI Checks
- `core/`: `yarn lint` and `yarn test` (CI jobs: `checks`, `test`). They should be unaffected by comment-only changes.

## Notes
- `scripts/generate_tags_table.sh` scans `<skill>/SKILL.md` and `<skill>/steps/*.md`, so it picks up the moved step automatically. Regenerating the table is the architect's follow-up, not a script change.
