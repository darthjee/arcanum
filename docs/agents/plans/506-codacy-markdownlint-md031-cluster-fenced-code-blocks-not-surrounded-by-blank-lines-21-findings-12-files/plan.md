# Plan: Codacy: markdownlint MD031 cluster — fenced code blocks not surrounded by blank lines (21 findings, 12 files)

Issue: [506-codacy-markdownlint-md031-cluster-fenced-code-blocks-not-surrounded-by-blank-lines-21-findings-12-files.md](../issues/506-codacy-markdownlint-md031-cluster-fenced-code-blocks-not-surrounded-by-blank-lines-21-findings-12-files.md)

## Overview

Codacy's markdownlint (MD031 — blanks-around-fences) flags 21 findings across 12 files where a fenced code block isn't surrounded by a blank line before and/or after it. The fix is purely mechanical: add the missing blank lines around each flagged fence, with no change to any code block's content. Following the same split used for the sibling MD032 cluster (issue #504), ownership is split by file type: skill files go to `skill-writer`, the one non-skill doc goes to `architect`.

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)

## Shared contracts

None. Each agent's changes are independent, file-scoped formatting fixes (adding blank lines around existing fenced code blocks) with no interface, schema, or behavior crossing the boundary between them.
