# Plan: Codacy: markdownlint MD040 cluster — fenced code blocks missing language (34 files)

Issue: [503-codacy-markdownlint-md040-cluster-fenced-code-blocks-missing-language-34-files.md](../../issues/503-codacy-markdownlint-md040-cluster-fenced-code-blocks-missing-language-34-files.md)

## Overview

Codacy's markdownlint (`markdownlint_MD040`) flags 34 fenced code blocks across 34 files that are missing a language tag. Verified directly against Codacy: every one of the 34 flagged blocks is a plain ``` fence wrapping a user-facing message template, an ASCII folder tree, a structured report template, or a settings-permission snippet — none of them is an actual shell command. All 34 fixes are therefore the same one-line change: add `text` right after the opening fence at the flagged line. The 34 files split cleanly by ownership: 27 are skill step/auxiliary files (`skill-writer`'s territory) and 7 are root-level/docs/agent-definition files (`architect`'s own territory, per its "project documentation, root-level files" scope).

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)

## Shared contracts

Both agents apply the exact same rule, so results stay consistent: change the bare ` ``` ` opening fence at the flagged line to ` ```text `, and nothing else — do not touch fence content or closing fences. No block in this set needs `bash`, `json`, or any other tag; content inspection (see per-agent file lists) confirmed every flagged fence is non-executable text (message templates, ASCII trees, report/log formats, or settings-permission syntax), not a real script.
