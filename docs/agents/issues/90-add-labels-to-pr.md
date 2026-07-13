# Issue: Read/write issue status via GitHub labels instead of body tags

## Description
Today, `auto-fix-all`, `discuss-issue`, and `monitor-issues` handle issue status/state markers (`:shipit:`, `:question:`, `:pencil2:`, `:clipboard:`, `:eyes:`, `:construction:`) as free-form tags embedded in the issue body's trailing `Tags:` block, parsed by `_lib/tags.sh` and mutated by `_lib/tag_mutate.sh`. This issue changes that mechanism to use real GitHub issue labels instead. (Originally filed as "Add labels to PR" — retitled since the actual scope is issue labels, not Pull Request labels; no PR-labeling work is in scope.)

## Problem
- Reading tags today means parsing the issue body text (via `extract_tags`/`has_tag`), which is a separate step from whatever action a script is already performing (e.g. `monitor_issues.sh` already fetches `labels` alongside `body` in its `gh issue list` call but only reads tags out of `body`).
- Writing tags today means fetching the whole issue body, splicing the `Tags:` block via `tag_mutate_add`/`tag_mutate_remove`, and pushing the entire body back via `gh issue edit --body-file` — more surface area than a targeted label add/remove.
- The `shipit` tag already straddles both worlds: `auto-fix-all/scripts/github.sh has-shipit-label` checks a real GitHub label, while `add-tag`/`remove-tag` still mutate the body's `Tags:` block.
- `:eyes:`, pushed by `auto-fix-all` right after fetching an issue (before `:construction:`), has no equivalent GitHub label today.

## Expected Behavior
- **Reading**: tag state is read from the GitHub issue's `labels`, ideally reusing a `labels` field already being fetched by the same script call for another purpose, rather than issuing a separate request or parsing body text.
- **Writing**: adding/removing a tag pushes/removes an actual GitHub label on the issue (`gh issue edit --add-label`/`--remove-label`), instead of rewriting the body's `Tags:` block. Exception: `shipit` stays human-only — no script ever adds or removes the `shipit` label; it remains exclusively a manual pre-approval signal applied on GitHub, with only the existing read path (`has-shipit-label`).
- The body's trailing `Tags:` block mechanism is fully retired: `_lib/tag_mutate.sh`'s body-splicing writers and all `Tags:` block parsing/rendering (including `discuss-issue`'s `TAGS_BEGIN`/`TAGS_END` passthrough and the issue template's tags section) are removed. GitHub labels become the only source of truth for issue status.
- PR monitoring's emoji-on-comment behavior (unrelated to issue tags) is unchanged.

## Solution
Introduce a label-to-canonical-tag-name mapping and switch the shared tag libraries (`_lib/tags.sh`, `_lib/tag_mutate.sh`, `_lib/tag_actions.sh`) plus their call sites (`monitor-issues/scripts/monitor_issues.sh`, `monitor-issues/scripts/github.sh`, `auto-fix-all/scripts/github.sh`, `_lib/github_issue.sh`) to read/write GitHub labels instead of body text:

| Tag | Emoji | Label |
| ---- | ----- | ----- |
| Created | pencil2 | Created |
| Ready | clipboard | Ready |
| shipit | shipit | shipit |
| Working | construction | Working |
| Question | question | Question |
| Fetched | eyes | Fetched |

Also add the new `Fetched` label (color `bfd4f2`) to `init-claude`'s default label set, so repos initialized/re-synced via `init-claude` (Step 10 — Setup repository labels, `init-claude/scripts/lib/label_config.sh`'s `DEFAULT_LABEL_PAIRS`) get it alongside the existing 9 defaults.

## Benefits
- Fewer AI tokens spent parsing/regenerating issue body text for status changes.
- Tag/label state becomes visible directly in the GitHub issue list UI, consistent with how `shipit` already works.
- Removes the redundant separate fetch/parse step when a script already has labels in hand from another call.
- Simpler mental model: one source of truth (GitHub labels) instead of two (labels for shipit reads, body text for everything else).
