# Plan: Codacy: markdownlint MD032 cluster — lists not surrounded by blank lines (29 findings, 22 files)

Issue: [504-codacy-markdownlint-md032-cluster-lists-not-surrounded-by-blank-lines-29-findings-22-files.md](../issues/504-codacy-markdownlint-md032-cluster-lists-not-surrounded-by-blank-lines-29-findings-22-files.md)

## Overview

Resolve all 29 Codacy MD032 findings (lists missing a blank line before and/or after) across 22 files by adding the missing blank lines, splitting the work by ownership: `architect` handles the root-level `ISSUE_TEMPLATE.md` and the `docs/agents/architecture/` files, `skill-writer` handles the skill `SKILL.md`/`steps/*.md`/scenario files.

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)

## Shared contracts

None — the two agents touch disjoint files and can work in parallel with no shared interface.
