# Plan: Codacy: markdownlint MD060 cluster — inconsistent table column style (26 findings, 15 files)

Issue: [505-codacy-markdownlint-md060-cluster-inconsistent-table-column-style-26-findings-15-files.md](../../issues/505-codacy-markdownlint-md060-cluster-inconsistent-table-column-style-26-findings-15-files.md)

## Overview

Codacy's markdownlint (`markdownlint_MD060`) flags 26 findings across 15 files for inconsistent table pipe styling. A sampling of the repo's existing tables confirmed `compact` (single space around cell content, delimiter row not padded to column width) is already the dominant style — only `init-claude/SKILL.md`'s scenario table is the fully space-padded `aligned` outlier. The fix pins `"MD060": { "style": "compact" }` in `.markdownlint.json` (mirroring how MD013 was pinned in #492/#493), then reformats every flagged table to `compact`. The 15 files split cleanly by ownership: 9 are root-level/docs/agent-definition files (`architect`'s own territory), and 4 are skill step/auxiliary files (`skill-writer`'s territory, per the precedent set in #503's MD040 plan). Two of the architect-owned files are `AUTO-GENERATED, DO NOT EDIT BY HAND` and must be fixed by re-running their generator scripts, not by hand-editing.

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)

## Shared contracts

Both agents apply the exact same rule: reformat every flagged table to `compact` style — single space of padding around each cell's content, delimiter row cells sized to (roughly) `---` and not stretched to match column width. Do not add/remove columns, reorder rows, or change cell content — only the pipe/space formatting changes. The style itself is a single source of truth pinned once, by `architect`, in `.markdownlint.json`'s `MD060.style` key; `skill-writer` reformats its files to match that same pinned style but does not touch `.markdownlint.json`.
