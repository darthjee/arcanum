# Issue: Codacy: markdownlint MD040 — docs/guides/arcanum-global-config.md (1 finding)

## Description

markdownlint MD040 flags fenced code blocks that have no language tag. Codacy (tool **markdownlint**, pattern `markdownlint_MD040`, category CodeStyle, severity **Info**) reports one finding:

- `docs/guides/arcanum-global-config.md:39`: Fenced code blocks should have a language specified

The flagged block is the one-line resolution-order diagram under `## Resolution order`:

```text
local repo state  ->  repo config  ->  global user config  ->  hardcoded default
```

## Problem

The opening fence at line 39 is a bare ```` ``` ````. Renderers can't pick a highlighter for it, and readers (and agents) can't tell at a glance that it's a plain-text diagram and not a shell command.

## Expected Behavior

- Codacy reports zero `markdownlint_MD040` findings for `docs/guides/arcanum-global-config.md`.
- `.markdownlint.json` stays unchanged, and the rendered Markdown looks the same.

## Solution

Change the opening fence at `docs/guides/arcanum-global-config.md:39` from ```` ``` ```` to ```` ```text ````. The block is a literal precedence diagram, not code, so `text` fits, matching the ```` ```text ```` fence already used at line 10 of the same file. Nothing else in the file changes.

Owner: `architect` agent (docs file).

---
_Source: Codacy API snapshot taken on 2026-09-24 (commit `5107a41`)._
