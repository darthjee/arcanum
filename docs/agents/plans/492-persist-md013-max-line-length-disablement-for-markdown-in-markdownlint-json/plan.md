# Plan: Persist MD013 (max line length) disablement for Markdown in .markdownlint.json

Issue: [492_persist-md013-max-line-length-disablement-for-markdown-in-markdownlint-json.md](../../issues/492-persist-md013-max-line-length-disablement-for-markdown-in-markdownlint-json.md)

## Overview

Codacy's cloud pattern settings already disable markdownlint's MD013 (max line length) for this repo, but `.markdownlint.json` doesn't reflect that — it only overrides `MD024`. This plan adds an explicit `"MD013": false` entry to `.markdownlint.json` so the disablement is durable and reviewable in-repo, matching what Codacy already enforces.

## Context

- `.markdownlint.json` currently contains only `{"MD024": {"siblings_only": true}}`.
- MD013 is confirmed absent from the repo's enabled markdownlint patterns on Codacy (43 enabled patterns checked via the Codacy API, MD013 not among them).
- Without a repo-tracked override, this decision is invisible in code review and not reproducible by anyone running markdownlint locally, and 67 stale `markdownlint_MD013` issues remain open against long-line documentation prose (`AGENTS.md`, `.claude/agents/*.md`, various `SKILL.md`/`steps/*.md` files).
- No CI job runs markdownlint locally in this repo (`.circleci/config.yml` only uploads coverage to Codacy) — enforcement is entirely via Codacy's cloud analysis, so there is no CI check to update here.

## Implementation Steps

### Step 1 — Add the MD013 override

Edit `.markdownlint.json` to add `"MD013": false` alongside the existing `MD024` entry, so the full file reads:

```json
{
  "MD024": {
    "siblings_only": true
  },
  "MD013": false
}
```

### Step 2 — Verify locally

Run markdownlint against the repo (e.g. `npx markdownlint-cli2 "**/*.md"`, since no markdownlint CLI is currently a repo dependency) to confirm no MD013 findings are reported and no other rule's behavior changed. This is a one-off local sanity check, not a new CI dependency.

## Files to Change

- `.markdownlint.json` — add `"MD013": false` to disable the max-line-length rule for Markdown, alongside the existing `MD024` override.

## Notes

- This only changes the repo-tracked config; Codacy's cloud pattern setting for MD013 was already disabled, so no Codacy-side change is needed.
- The 67 pre-existing `markdownlint_MD013` issues should clear automatically once Codacy re-analyzes the repo after this change merges — no per-file cleanup is required.
