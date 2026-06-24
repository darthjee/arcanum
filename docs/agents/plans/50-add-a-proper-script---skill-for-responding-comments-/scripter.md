# Scripter Plan: Add a proper script / skill for responding comments

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the script consumed by `architect`'s update to `handle_comment.md`:

```
reply_comment.sh <id> <agent> <model_name> <model_email> <reply_body>
```

- `<id>`: numeric GitHub issue id of the currently checked-out `issue-<id>` branch. Resolve the PR via `../auto-monitor-issue-pr/scripts/resolve_pr_number.sh <id>` (resolved relative to the `auto-fix-all` skill folder).
- `<agent>` / `<model_name>` / `<model_email>`: attribution fields, same shape already passed to `auto-fix-issue/scripts/commit_change.sh`.
- `<reply_body>`: full reply text.
- On success: posts the rendered reply as a PR comment via `gh pr comment`, exit 0.
- On bad args or `gh`/`resolve_pr_number.sh` failure: print `Usage: ...` or the underlying error to stderr, exit non-zero. No retry loop — single-shot.

## Implementation Steps

### Step 1 — Add the reply template

Create `auto-fix-all/templates/reply.tmpl.md`, mirroring the placeholder style of `discuss-issue/templates/issue.tmpl.md` (e.g. `%%BODY%%`, `%%AGENT%%`, `%%MODEL_NAME%%`, `%%MODEL_EMAIL%%`). Suggested shape:

```
%%BODY%%

_Replied by: %%AGENT%% agent (%%MODEL_NAME%% %%MODEL_EMAIL%%)_
```

### Step 2 — Add `reply_comment.sh`

Create `auto-fix-all/scripts/reply_comment.sh`:

- Usage: `reply_comment.sh <id> <agent> <model_name> <model_email> <reply_body>`. Validate all five args are non-empty (and `<id>` numeric, stripping a leading `#` same as `resolve_pr_number.sh` does); usage error to stderr + exit 1 otherwise.
- Resolve the PR number: `../auto-monitor-issue-pr/scripts/resolve_pr_number.sh "$ID"` (path resolved relative to this script's own directory, e.g. via `$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../auto-monitor-issue-pr/scripts/resolve_pr_number.sh`). Propagate its failure (it already prints its own error to stderr).
- Resolve the repo ref the same way the other `auto-fix-all/scripts/*.sh` do — reuse the existing `auto-fix-all/scripts/_lib_origin.sh` (source it, call `get_repo_ref`), consistent with `checkout_from_main.sh`/`github.sh` in this same folder. Do not duplicate the parsing logic inline.
- Render the template: substitute `%%BODY%%`, `%%AGENT%%`, `%%MODEL_NAME%%`, `%%MODEL_EMAIL%%` into `auto-fix-all/templates/reply.tmpl.md` (resolve the template path relative to the script's own directory, e.g. `$SCRIPT_DIR/../templates/reply.tmpl.md`), writing the rendered content to a temp file (or piping directly).
- Post it: `gh pr comment "$PR_NUMBER" -R "$REPO_REF" --body-file -` (or a temp file) with the rendered content.
- Print nothing extra on success beyond what `gh pr comment` itself prints; exit 0.

Look at `auto-fix-all/scripts/github.sh` and `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` for the existing conventions (set -euo pipefail, sourcing `_lib_origin.sh`, stripping a leading `#` from ids) before writing this — keep the same style.

### Step 3 — Sanity-check manually

There is no test suite in this repo. Manually verify the script's argument validation (missing args, non-numeric id) exits non-zero with a clear usage message, and that the template renders with no leftover `%%...%%` placeholders given sample inputs (you can render to a file and `cat` it without actually calling `gh pr comment` to verify substitution, then separately confirm the `gh pr comment` invocation line is well-formed by reading it back).

## Files to Change

- `auto-fix-all/templates/reply.tmpl.md` — new
- `auto-fix-all/scripts/reply_comment.sh` — new

## Notes

- Keep the script self-contained within `auto-fix-all/scripts/` per this repo's convention of each skill folder owning its own copy of shared helpers (see the comment at the top of `auto-monitor-issue-pr/scripts/_lib_origin.sh` explaining why `auto-fix-all` keeps its own copy rather than sharing one).
- Do not touch `handle_comment.md` — that is `architect`'s file.
