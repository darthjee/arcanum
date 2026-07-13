# Plan: Read/write issue status via GitHub labels instead of body tags

Issue: [90-add-labels-to-pr.md](../issues/90-add-labels-to-pr.md)

## Overview

Replace the body-embedded `Tags:` block mechanism (parsed/mutated by `_lib/tags.sh` and `_lib/tag_mutate.sh`) with real GitHub issue labels as the sole source of truth for issue status. Reading switches from parsing `body` text to reading the `labels` field already present in every relevant `gh`/REST payload (no new API calls). Writing switches from rewriting the whole issue body to `gh issue edit --add-label`/`--remove-label`, except `shipit`, which stays human-only (read-only from the pipeline's perspective). A new `Fetched` label (color `bfd4f2`) is added to `init-claude`'s default label set to replace the old `:eyes:` body tag. The canonical, colon-stripped tag vocabulary (`question`, `pencil2`, `clipboard`, `shipit`, `construction`, `eyes`) used throughout call sites (e.g. `add-tag <id> eyes`) is preserved unchanged — only what backs it changes — so most call sites need no edits at all.

## Context

See the issue file for full background. Key finding from codebase exploration: `monitor-issues/scripts/monitor_issues.sh` already fetches `labels` in the same `gh issue list --json number,title,updatedAt,body,labels` call it uses to fetch `body`, but only ever reads tags out of `body` — this is the concrete "squeeze together" opportunity named in the issue. Similarly, `_lib/github_issue.sh`'s `cmd_fetch` already receives `labels` in the raw GitHub REST issue payload it curls, alongside `body`.

## Label / canonical-tag mapping

| Canonical tag (unchanged call-site vocabulary) | GitHub label name |
| --- | --- |
| `pencil2` | `Created` |
| `clipboard` | `Ready` |
| `shipit` | `shipit` |
| `construction` | `Working` |
| `question` | `Question` |
| `eyes` | `Fetched` (**new** label) |

## Implementation Steps

### Step 1 — Add the `Fetched` default label

In `init-claude/scripts/lib/label_config.sh`, add `Fetched:bfd4f2` to `DEFAULT_LABEL_PAIRS` (alongside the existing `Created`/`Working`/`Ready`/`shipit` entries). No other change needed — `sync_labels.sh`/`setup_labels.md` already generically sync whatever is in the table.

### Step 2 — Rewrite `_lib/tags.sh` to be label-backed

Replace the `:word:`/emoji-parsing implementation of `extract_tags`/`has_tag` with a label-name-based implementation:
- Introduce the canonical-tag ↔ label-name table above as the single source of truth (e.g. a `case` lookup both directions: label-name-for-tag and tag-for-label-name).
- `extract_tags <labels_text>` now takes a newline-separated list of GitHub label names (not body text) and prints, one per line, the canonical tag name for each recognized label present — unrecognized labels (e.g. `Bug`, `Feature`, `Enqueued`) are silently ignored, same "ignore what you don't recognize" spirit as today.
- `has_tag <labels_text> <tag>` unchanged in signature/behavior, just operating on the new input shape.
- Remove the emoji-alias handling (❓✏️📋👀🚧) — no longer relevant once there's no body text to scan.
- Update the file's header comment to describe the new contract (input is a label list, not free text).

### Step 3 — Rewrite `_lib/tag_mutate.sh` to mutate real labels

- Replace `tag_mutate_add`/`tag_mutate_remove` (body-string splicing) with thin wrappers around `gh issue edit --add-label "<label>"` / `--remove-label "<label>"`, resolving `<label>` via Step 2's lookup table.
- Replace `tag_mutate_fetch_and_push` with a simpler `tag_mutate_add_label`/`tag_mutate_remove_label`-style function (naming at `scripter`'s discretion) that no longer needs to fetch/push the whole body — `gh issue edit --add-label`/`--remove-label` mutates labels directly. Preserve the existing "already present" / "not present" no-op messages and the `Added`/`Removed` confirmation message shape, since callers (`auto-fix-all/scripts/github.sh`, `monitor-issues/scripts/github.sh`) parse/relay that output.
- Guard `shipit`: if the resolved canonical tag is `shipit`, refuse with a clear error (exit 1, message like `"shipit is human-only; scripts must not add or remove it"`) instead of calling `gh issue edit` — this enforces the "human-only" decision at the shared-library level, not just by convention.
- Update the file's header comment accordingly.

### Step 4 — Update `_lib/tag_actions.sh`

`actionable_tags <text>` now receives a label list (same shape as Step 2's `extract_tags` input) instead of body text — the function body barely changes since it already delegates to `has_tag`, but update the doc comment to reflect the new input contract.

### Step 5 — Update `_lib/github_issue.sh`'s `cmd_fetch`

- Stop calling `extract_tags_block`/`strip_tags_block` on `body` and stop emitting `TAGS_BEGIN`/`TAGS_END`.
- Extract `.labels[].name` from the already-fetched REST payload (`$result`), map to canonical tag names via Step 2's `extract_tags`, and pass that to `issue_state.sh set-json <id> tags` exactly as today (schema of the stored `tags` field in `.claude/state/issue-<id>.json` is unchanged — only its source changes).
- Remove the now-dead `extract_tags_block`/`strip_tags_block` helper functions.
- The saved local `docs/agents/issues/<id>-<slug>.md` file no longer has a trailing `Tags:` block stripped from it (there isn't one to strip) — no behavior change needed there beyond removing the dead code path.

### Step 6 — Remove `TAGS_BEGIN`/`TAGS_END` passthrough across `discuss-issue` and `auto-new-issue`

Since `cmd_fetch` no longer emits this block (Step 5), remove all downstream handling of it:
- `discuss-issue/steps/extract_id_and_name.md` — drop the "If the output includes a `TAGS_BEGIN`/`TAGS_END` block..." paragraph.
- `discuss-issue/steps/discuss_and_save.md` — drop the tags_block carry-over instructions in steps 2 and the "Push to GitHub" section's references.
- `discuss-issue/steps/issue_template.md` — drop the "Tags line" section entirely.
- `discuss-issue/templates/issue.tmpl.md` — remove the `%%TAGS%%` placeholder line.
- `discuss-issue/scripts/render_issue.sh` — drop the `tags_block` parameter (8th positional arg) and the `%%TAGS%%` substitution/wrapping logic.
- `discuss-issue/scripts/resolve_and_fetch.sh` — update its header comment (no longer mentions a TAGS_BEGIN/TAGS_END block following on fresh fetch).
- `auto-new-issue/steps/run.md` — drop the "If the body ended with a trailing `---`/`tags: ...` block..." sentence in Step 2's description.
- `auto-new-issue/steps/write_issue.md` — drop the "If Step 2's `github.sh fetch` call printed a `TAGS_BEGIN`/`TAGS_END` block..." paragraph.

### Step 7 — Update `monitor-issues/scripts/monitor_issues.sh`

- Drop `body` from the `--json number,title,updatedAt,body,labels` field list (now unused) — keep `labels`.
- Replace `BODY=$(echo "$ISSUE" | jq -r '.body // ""')` with an equivalent extraction of label names, e.g. `LABELS=$(echo "$ISSUE" | jq -r '.labels[].name')`.
- Replace `extract_tags "$BODY"` and `actionable_tags "$BODY"` calls with the `$LABELS` equivalent.
- Update the file's header comment ("parses tags from the issue body" → "parses tags from the issue's labels").

### Step 8 — Update `auto-rewrite-issue/steps/run.md`

Remove the now-obsolete sentence in Step 2.2 about preserving a trailing `Tags:` block verbatim (there is no such block to preserve anymore). Step 2.4's `remove-tag <id> pencil2` call is unchanged (canonical vocabulary preserved).

### Step 9 — Retire `auto-fix-all/scripts/has_shipit_tag.sh` and simplify pre-approval check

- Delete `auto-fix-all/scripts/has_shipit_tag.sh` — it checked the local issue file's body for a `:shipit:` token, which no longer exists as a concept once the body-Tags mechanism is retired.
- Update `auto-fix-all/steps/process_one_issue.md`'s "Check for pre-approval" section (Step 5) to check only `scripts/github.sh has-shipit-label <id>` — drop the second `has_shipit_tag.sh <ISSUE_FILE>` source and the `resolve_plan_paths.sh` call that only existed to locate the issue file for that check (verify it isn't needed elsewhere in that step before removing it).

### Step 10 — Update `docs/agents/architecture.md`

Rewrite the "Issue Tags" section to describe the new label-backed mechanism: labels are the sole source of truth (no body `Tags:` block), the canonical-tag/label-name mapping table, `shipit` as human-only/read-only, and the removal of `has_shipit_tag.sh`'s dual-source pre-approval check. Update the "Tag mutation primitives" subsection to describe the new `gh issue edit --add-label`/`--remove-label`-based implementation. Update the `init-claude-config.json` row's default-label mention to include `Fetched`.

## Files to Change

- `init-claude/scripts/lib/label_config.sh` — add `Fetched:bfd4f2` to `DEFAULT_LABEL_PAIRS`
- `_lib/tags.sh` — label-based `extract_tags`/`has_tag`, canonical-tag/label-name table
- `_lib/tag_mutate.sh` — `gh issue edit --add-label`/`--remove-label`-based mutation, `shipit` guard
- `_lib/tag_actions.sh` — doc comment update (input contract change)
- `_lib/github_issue.sh` — `cmd_fetch` reads `labels` instead of parsing/stripping body `Tags:` block
- `discuss-issue/steps/extract_id_and_name.md` — remove TAGS_BEGIN/TAGS_END handling
- `discuss-issue/steps/discuss_and_save.md` — remove tags_block passthrough
- `discuss-issue/steps/issue_template.md` — remove "Tags line" section
- `discuss-issue/templates/issue.tmpl.md` — remove `%%TAGS%%` placeholder
- `discuss-issue/scripts/render_issue.sh` — drop `tags_block` parameter
- `discuss-issue/scripts/resolve_and_fetch.sh` — update header comment
- `auto-new-issue/steps/run.md` — remove TAGS_BEGIN/TAGS_END mention
- `auto-new-issue/steps/write_issue.md` — remove TAGS_BEGIN/TAGS_END mention
- `monitor-issues/scripts/monitor_issues.sh` — read labels instead of body
- `auto-rewrite-issue/steps/run.md` — remove obsolete "preserve Tags: block" note
- `auto-fix-all/scripts/has_shipit_tag.sh` — delete
- `auto-fix-all/steps/process_one_issue.md` — simplify pre-approval check to label-only
- `docs/agents/architecture.md` — rewrite "Issue Tags" section

## Notes

- `auto-fix-all/scripts/github.sh` (`add-tag`/`remove-tag`/`has-shipit-label`) and `monitor-issues/scripts/github.sh` (`remove-tag`) are thin CLI wrappers around `_lib/tag_mutate.sh` — their own code likely needs no changes (same call signatures), but re-verify their usage-string comments still match once Step 3 lands, since those comments currently say "trailing `Tags:` line".
- Double-check no other skill (e.g. `plan-issue`, `auto-fix-issue`) references `extract_tags_block`/`strip_tags_block`/`TAGS_BEGIN` beyond the files listed above — the exploration grep found none, but re-grep after the rename in case something was missed.
- This is a pure bash-skills repo with no CI workflow configured (no `.github/workflows`, no CircleCI config) — no `## CI Checks` section applies. Validate manually by running the affected scripts against a scratch issue/label on GitHub.
