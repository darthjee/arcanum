# Plan: Keep tags on new-issue

Issue: [11-keep-tags-on-new-issue.md](../../issues/11-keep-tags-on-new-issue.md)

## Overview

`cmd_fetch` in `github.sh` (both `new-issue` and `auto-new-issue` copies) currently saves the raw GitHub body verbatim and lets the issue's free-text restructuring step (`collect_and_save.md` / `write_issue.md`) drop a trailing `---`/`tags: ...` block. Extract the tags-block detection into the script (deterministic regex), have it print a `TAGS=` line when found, and update the restructuring steps to re-append that exact block at the end of the final file.

## Context

A trailing tags block looks like:
```
---

tags: :some_tag:
```
at the very end of the body (one or more blank lines after the `---`, then a line starting with `tags:`). `cmd_fetch` already writes the raw body to a file and prints `TITLE`/`FILE`/`DOMAIN`/`REPO`. The restructuring instructions in `new-issue/steps/collect_and_save.md` and `auto-new-issue/steps/write_issue.md` rewrite that raw body into a structured template, which is where the tags block currently gets lost (it's not part of any template section, so nothing tells the rewrite step to keep it).

## Implementation Steps

### Step 1 — Detect and extract the tags block in `cmd_fetch` (both `new-issue/scripts/github.sh` and `auto-new-issue/scripts/github.sh`, kept byte-identical)

After fetching `body`, check for a trailing block matching (conceptually): one or more blank lines, then a line `---`, then one or more blank lines, then a line starting with `tags:`, to the end of the string. If found:
- Capture the matched block text (from the `---` line to the end, trimmed of trailing whitespace) into a `tags_block` variable.
- Strip that block from `body` before writing it to `filepath` (so the saved raw file no longer contains it — it will be re-appended later by the restructuring step instead of risked being lost or duplicated mid-rewrite).
- After the existing `TITLE=`/`FILE=`/`DOMAIN=`/`REPO=` output lines, print `TAGS=<tags_block>` (single line; if the block has internal newlines, the consuming step should know `TAGS` is the rest of the output, e.g. by using a distinct sentinel format like outputting it last and reading "everything after `TAGS=`" — decide a parseable convention is during implementation, e.g. base64-encode the block on one line, or use a multi-line printf with a clear `TAGS_BEGIN`/`TAGS_END` marker pair instead of a single `KEY=value` line).
- If no trailing tags block is found, do not print a `TAGS` line at all (its absence means nothing to preserve).

### Step 2 — Use the extracted tags in `new-issue/steps/collect_and_save.md`

When writing the final structured issue file: if a `TAGS` block was reported by the `fetch` step, append it verbatim (blank line, then the block) at the very end of the file, after the "See issue for details" line. If no `TAGS` was reported, write the file exactly as today (no spurious tags line).

### Step 3 — Use the extracted tags in `auto-new-issue/steps/write_issue.md`

Same handling as Step 2, adapted to this skill's template (Context/What needs to be done/Acceptance criteria) — append the preserved block at the very end of the file when `TAGS` was reported by Step 2 of `auto-new-issue/SKILL.md`'s fetch call.

### Step 4 — Manual verification

Test `cmd_fetch` against a real or mocked GitHub issue body containing a trailing tags block (e.g. issue #11 itself, which carries `tags: :shipit:`) to confirm: the block is stripped from the saved raw file, `TAGS` is reported correctly, and a body with no tags block produces no `TAGS` output and is otherwise unaffected.

## Files to Change

- `new-issue/scripts/github.sh`
- `auto-new-issue/scripts/github.sh`
- `new-issue/steps/collect_and_save.md`
- `auto-new-issue/steps/write_issue.md`

## Notes

- No CI config exists in this repo; verification is manual, as described in Step 4.
- This is self-contained script + prose work — no agent split needed.
