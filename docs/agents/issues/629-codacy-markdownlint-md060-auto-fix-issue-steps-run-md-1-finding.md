# Issue: Codacy: markdownlint MD060 — auto-fix-issue/steps/run.md (1 finding)

## Description

Codacy (markdownlint, pattern `markdownlint_MD060`, category CodeStyle, severity **Info**) reports one finding in `auto-fix-issue/steps/run.md`. MD060 checks table column style, which `.markdownlint.json` configures as `compact`.

_Source: Codacy API snapshot taken on 2026-09-24 (commit `0a6c426`), one of a batch of about 30 issues covering the worst open Codacy findings._

## Problem

`auto-fix-issue/steps/run.md:22` — the delimiter row of the resume-step table ("Recorded value | Step completed | Resume from") has no spaces around its pipes:

```markdown
|---|---|---|
```

The header and body rows of that table already use the compact style (`| a | b | c |`); only the delimiter row is off.

## Expected Behavior

- Codacy reports zero `markdownlint_MD060` findings for `auto-fix-issue/steps/run.md`.
- `.markdownlint.json` is left unchanged.
- The rendered table looks exactly the same; no content changes.

## Solution

Change line 22 of `auto-fix-issue/steps/run.md` from `|---|---|---|` to `| --- | --- | --- |`. That is the only table in the `auto-fix-issue` skill with this pattern, so no other file needs editing.
