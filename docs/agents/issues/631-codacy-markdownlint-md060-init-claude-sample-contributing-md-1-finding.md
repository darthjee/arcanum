# Issue: Codacy: markdownlint MD060 — init-claude/sample-contributing.md (1 finding)

## Description

Codacy (markdownlint, pattern `markdownlint_MD060`, category CodeStyle, severity **Info**) reports one finding in `init-claude/sample-contributing.md`. MD060 checks table column style, and `.markdownlint.json` sets it to `compact`.

- `init-claude/sample-contributing.md:74`: "Table pipe is missing space to the right for style `compact`". The flagged line is the delimiter row `|---|---|` of the Application / Entrypoint table (lines 73–76).

This is the only table in the file. The file is the reference template that `init-claude/setup_contributing.md` reads when generating a project's CONTRIBUTING.md.

_Source: Codacy API snapshot taken on 2026-09-24 (commit `0a6c426`). One of a batch of about 30 issues covering the worst open Codacy findings._

## Problem

The delimiter row `|---|---|` has no spaces around its cells, which breaks the `compact` table style the repo sets for MD060.

## Expected Behavior

- Codacy reports zero `markdownlint_MD060` findings for `init-claude/sample-contributing.md`.
- `.markdownlint.json` stays unchanged.
- The table renders the same, and no other content in the file changes.

## Solution

Change line 74 from `|---|---|` to `| --- | --- |`. The header and body rows already follow the compact style, so they stay as they are. This is the same one-line fix applied in #629 (`auto-fix-issue/steps/run.md`).
