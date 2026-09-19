# Plan: Codacy: markdownlint MD033 cluster — inline HTML in markdown (18 findings, 10 files)

Issue: [507-codacy-markdownlint-md033-cluster-inline-html-in-markdown-18-findings-10-files.md](../../issues/507-codacy-markdownlint-md033-cluster-inline-html-in-markdown-18-findings-10-files.md)

## Overview

Eliminate the MD033 (no-inline-html) findings across the 10 flagged files. Two independent workstreams: the four commit-message template files (fence their bodies as code, and stop hand-syncing the two copies of each) belong to `architect`, since they live at repo root / `docs/` and no specialist owns them; the five `SKILL.md` files with a bare placeholder in an `Agent(...)` prompt line belong to `skill-writer`.

A local `npx markdownlint-cli2 <file>` run (this repo's `.markdownlint.json` is picked up automatically) found *more* MD033 violations per file than Codacy's summarized counts in the issue — e.g. `auto-fix-all/SKILL.md` line 34 has 5 separate flagged tags, not 1, and each commit-message template has 8, not 3. Both agents should treat the issue's file list as authoritative but its per-file counts as a floor, and confirm zero remaining MD033 errors via a fresh markdownlint run against each file they touch rather than counting sites by hand.

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)

## Shared contracts

None. The two agents touch disjoint file sets (architect: `.github/`, `init-claude/templates/`, `docs/agents/architecture/`, `scripts/`, `.circleci/config.yml`; skill-writer: the five `SKILL.md` files) with no interface, shared schema, or dependency between their changes.
