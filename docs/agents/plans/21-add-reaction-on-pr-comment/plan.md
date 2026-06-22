# Plan: Add reaction on PR comment

Issue: [21-add-reaction-on-pr-comment.md](../../issues/21-add-reaction-on-pr-comment.md)

## Overview

Make the PR-monitoring loop track each new owner comment's lifecycle (open → addressed) in a small JSON state file, signal that lifecycle to the user via GitHub reactions on the comment itself, and let the commit that addresses a comment link back to it. No agent split: the only specialist agent in this project (`scripter`) owns the script changes, and the accompanying skill-markdown/template changes are made directly by the architect, same as any other single-file plan.

## Context

`auto-monitor-pr/scripts/monitor_pr.sh` already polls a PR and detects new owner comments (issue-level, inline review comments, and review bodies), normalizing them to `{login, createdAt, body}` and printing `commented` + each body. It has no concept of comment identity, persistent status, or reactions. `auto-fix-issue/scripts/commit_change.sh` builds a fixed commit message and has no way to reference a comment. `auto-fix-all/steps/handle_comment.md` dispatches comment bodies to specialist agents but never carries a comment identity forward to the commit step.

GitHub's reaction API (both REST and GraphQL) only supports a fixed content set: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`, `rocket`, `eyes` — there is no check-mark reaction. This plan uses `eyes` for "being addressed" (as requested) and substitutes `+1` (👍 thumbs up) for the requested ✔️/`heavy_check_mark` once addressed, since that reaction does not exist on GitHub. This substitution is called out again in Notes.

GraphQL's `addReaction`/`removeReaction` mutations take a `subjectId` (a node ID) and work uniformly across issue comments, inline review comments, and review bodies — all three are `Reactable` and all three already expose a GraphQL node ID in the `gh pr view --json comments,reviews` output (field `id`) and in `gh api .../pulls/{pr}/comments` (field `node_id`). Using GraphQL avoids needing different REST endpoints per comment type and avoids having to store the reaction's own ID for later removal (`removeReaction` only needs `subjectId` + `content` again).

## Implementation Steps

### Step 1 — Carry comment identity through `monitor_pr.sh`'s normalization

In `auto-monitor-pr/scripts/monitor_pr.sh`, extend the jq normalization (currently `{login, createdAt, body}`, around lines 81-87) to also capture a node ID and an HTML URL per source:
- Issue-level comments (`$conv.comments[]`): `id: .id`, `url: .url`.
- Inline review comments (`$inline[]`, from `gh api repos/.../pulls/{pr}/comments`): `id: .node_id`, `url: .html_url`.
- Review bodies (`$conv.reviews[]`): `id: .id`, `url: .url`.

These are the same `gh pr view --json comments,reviews` / `gh api pulls/comments` calls already made — no new API calls, just additional fields pulled from the existing responses.

### Step 2 — Add a comment-state JSON file alongside the since-file

Add `COMMENTS_FILE=".claude/state/auto-monitor-pr-${PR_NUMBER}-comments.json"` next to the existing `SINCE_FILE`. Format:

```json
{
  "comments": [
    { "id": "<graphql node id>", "user": "<login>", "url": "<html url>", "status": "open" }
  ]
}
```

Add two small helper functions in `monitor_pr.sh`:
- `load_comments_state()` — `cat "$COMMENTS_FILE" 2>/dev/null || echo '{"comments":[]}'`.
- `save_comments_state(json)` — `mkdir -p "$(dirname "$COMMENTS_FILE")"` then write the given JSON to `$COMMENTS_FILE`.

### Step 3 — Resolve any previously-open comments at the start of each invocation

Before entering the polling `while` loop, run a one-shot pass: load the comments state; for every entry with `status == "open"`, this invocation is happening because the branch was just pushed in response to it (per `auto-fix-all/steps/handle_comment.md`'s "push, then return to the top of [monitor_pr.md] to resume monitoring" flow) — so:
1. `removeReaction` (`content: EYES`) on that comment's node ID.
2. `addReaction` (`content: THUMBS_UP`) on the same node ID.
3. Set its `status` to `"addressed"` in the in-memory state.

Save the updated state once, after processing every open entry. If the state file does not exist yet (first ever run for this PR), this pass is a no-op.

Add the two reaction helpers (used here and in Step 4):

```bash
add_reaction() { # $1 = node id, $2 = ReactionContent (EYES|THUMBS_UP)
  gh api graphql -f query='mutation($id:ID!,$content:ReactionContent!){addReaction(input:{subjectId:$id,content:$content}){reaction{id}}}' -F id="$1" -F content="$2" >/dev/null 2>&1 || true
}
remove_reaction() { # $1 = node id, $2 = ReactionContent
  gh api graphql -f query='mutation($id:ID!,$content:ReactionContent!){removeReaction(input:{subjectId:$id,content:$content}){subject{id}}}' -F id="$1" -F content="$2" >/dev/null 2>&1 || true
}
```

Failures are swallowed (`|| true`) — a reaction failing must never block monitoring; this is best-effort signaling, not the source of truth (the JSON state and the actual comment thread remain authoritative).

### Step 4 — React to and record newly-found comments

In the existing "new comments found" branch (currently `count -gt 0`, right before printing `commented`):
1. For each new comment, call `add_reaction "<id>" EYES`.
2. Append each new comment as `{id, user: login, url, status: "open"}` to the comments state and save it.
3. Skip this for the `:shipit:`-shorthand case (that branch already `exit 0`s as `approved` before reaching the print-comments code, so no change needed there).

### Step 5 — Extend the `commented` output with comment identity

Change the final print (currently `echo "$new_comments" | jq -r '.[] | "---\n" + .body'`) to also emit `id` and `url` per block, e.g.:

```bash
echo "$new_comments" | jq -r '.[] | "---\nid: " + .id + "\nurl: " + .url + "\n" + .body'
```

This is a breaking change to the `commented` output contract — update every reader of it (Step 6).

### Step 6 — Update consumers of the `commented` output format

- `auto-monitor-pr/SKILL.md` — update the description of the `commented` output: each `---`-separated block now starts with `id: <node id>` and `url: <html url>` lines before the comment body.
- `auto-monitor-issue-pr/SKILL.md` — check whether it restates the output format; if so, update it the same way (it otherwise just forwards the outcome, no logic change expected).
- `auto-fix-all/steps/monitor_pr.md` — update the `### If commented` section to mention that each block now carries `id`/`url` metadata ahead of the body.
- `auto-fix-all/steps/handle_comment.md` — when parsing each comment block to dispatch it, also extract its `url`; pass that URL through to the dispatched agent (or to the architect's own work, if no agent is responsible) as the value for the new optional comment-link parameter added to `commit_change.sh` in Step 7. Update the example invocation accordingly.

### Step 7 — Let `commit_change.sh` link back to the comment it addresses

In `auto-fix-issue/scripts/commit_change.sh`, add an optional 9th parameter `[comment_url]` after the existing `[body]`:

```
Usage: commit_change.sh <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]
```

When `comment_url` is non-empty, append a trailer line to the message:

```
Addresses-Comment: <comment_url>
```

placed after the optional `BODY` paragraph and before the `Co-Authored-By` lines. When `comment_url` is empty (initial commits, or any commit not addressing a specific review comment), the message is unchanged from today — no new variant/branch of the script is needed, so the issue's "split into initial vs. comment-addressing variants" option is not taken; a single optional trailing parameter covers both cases without adding a second script or template (see Notes).

### Step 8 — Update commit-message template docs

Update both `.github/commit_message_template.md` and `init-claude/templates/commit_message_template.md` (kept identical, per existing convention) to document the new optional trailer:

```
<type>(<scope>): <subject> (issue #<id>)

<optional body: what was done and why, if not obvious>

Addresses-Comment: <optional: URL of the PR comment this commit addresses>

Co-Authored-By: <AI model name> <AI model email>
Co-Authored-By: <agent> agent <AI model email>
```

### Step 9 — Update `auto-fix-issue`'s dispatch instructions

In `auto-fix-issue/steps/dispatch_agents.md`, update the `commit_change.sh` invocation example and the parameter list to mention the optional `<comment_url>` argument, and note it is only passed when the work being committed addresses a specific PR comment carried over from `handle_comment.md` (Step 6) — otherwise it's omitted, same as today's optional `<body>`.

## Files to Change

- `auto-monitor-pr/scripts/monitor_pr.sh` — capture comment `id`/`url`, add comment-state JSON file, add `add_reaction`/`remove_reaction` GraphQL helpers, resolve previously-open comments at start, react to and record new comments, extend `commented` output with `id`/`url`.
- `auto-monitor-pr/SKILL.md` — document the extended `commented` output format.
- `auto-monitor-issue-pr/SKILL.md` — same, if it restates the format.
- `auto-fix-issue/scripts/commit_change.sh` — add optional `[comment_url]` parameter and `Addresses-Comment:` trailer.
- `auto-fix-issue/steps/dispatch_agents.md` — document the optional comment-link argument.
- `auto-fix-all/steps/monitor_pr.md` — document the extended `commented` output format.
- `auto-fix-all/steps/handle_comment.md` — extract `url` per comment block and pass it through to the commit step.
- `.github/commit_message_template.md` — add `Addresses-Comment:` trailer documentation.
- `init-claude/templates/commit_message_template.md` — same, kept in sync.

## Notes

- GitHub reactions have a fixed content set with no check-mark equivalent. This plan uses `EYES` (👀) for "being addressed", as requested, and substitutes `THUMBS_UP` (👍) for the requested ✔️ once addressed — there is no `heavy_check_mark`/`white_check_mark` reaction on GitHub's API (REST or GraphQL). If a different substitute emoji is preferred, swap the literal `THUMBS_UP` in Step 3's `add_reaction` call.
- The "previously open ⇒ now addressed" swap in Step 3 is a one-shot assumption made every time `monitor_pr.sh` is (re)started: any comment still marked `open` is assumed addressed by whatever caused this fresh invocation. This matches the only caller that restarts monitoring after a push (`auto-fix-all/steps/monitor_pr.md`'s `commented` branch, via `handle_comment.md`), but means manually re-running `/auto-monitor-pr` on the same PR outside that flow will also mark any still-open comments as addressed, even if nobody actually addressed them. Acceptable for this skill family's autonomous use case; flagged here in case that assumption needs revisiting later.
- Review bodies (top-level PR reviews, as opposed to inline review comments or issue-level comments) are reactable via GraphQL just like the other two types, so no special-casing was needed there.
- No script split between "initial commit" and "comment-addressing commit" variants (the issue floated this as an option) — a single optional trailing parameter on the existing `commit_change.sh` covers both, consistent with how `[body]` already works as an optional trailing parameter.
- No `## CI Checks` section: this repository has no CI configuration (no `.github/workflows`, no `.circleci`) to run locally.
