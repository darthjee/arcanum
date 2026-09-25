# Plan: Codacy: markdownlint MD040 — docs/guides/arcanum-global-config.md (1 finding)

Issue: [618-codacy-markdownlint-md040-docs-guides-arcanum-global-config-md-1-finding.md](../../issues/618-codacy-markdownlint-md040-docs-guides-arcanum-global-config-md-1-finding.md)

## Overview

Add a `text` language tag to the one untagged fenced code block in `docs/guides/arcanum-global-config.md` to clear Codacy's single `markdownlint_MD040` finding there.

## Context

Codacy flags `docs/guides/arcanum-global-config.md:39` because its opening fence has no language tag. The block is the one-line resolution-order diagram under `## Resolution order`:

```text
local repo state  ->  repo config  ->  global user config  ->  hardcoded default
```

It's a literal diagram, not code, so `text` is the right tag. It also matches the ```` ```text ```` fence already used at line 10 of the same file.

## Implementation Steps

### Step 1 — Tag the resolution-order fence

In `docs/guides/arcanum-global-config.md`, change the opening fence at line 39 from ```` ``` ```` to ```` ```text ````. Leave the block's content, its closing fence (line 41), and the rest of the file as they are.

## Files to Change

- `docs/guides/arcanum-global-config.md` — add `text` to the opening fence at line 39.

## Notes

- No CI job runs markdownlint locally. To verify, run `grep -n '^```' docs/guides/arcanum-global-config.md` and confirm every opening fence has a language tag. The final check is Codacy re-analyzing the PR.
- Leave `.markdownlint.json` unchanged.
- Docs file with no specialist owner: the `architect` handles it directly.
