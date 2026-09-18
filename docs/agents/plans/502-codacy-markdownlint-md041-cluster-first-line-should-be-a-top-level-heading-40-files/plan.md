# Plan: Codacy: markdownlint MD041 cluster — first line should be a top-level heading (40 files)

Issue: [502-codacy-markdownlint-md041-cluster-first-line-should-be-a-top-level-heading-40-files.md](../issues/502-codacy-markdownlint-md041-cluster-first-line-should-be-a-top-level-heading-40-files.md)

## Overview

Resolve all 40 Codacy MD041 findings by extending `.markdownlint.json` to recognize `name:` frontmatter as a title (covering ~24 `SKILL.md`/`.claude/agents/*.md` files) and to exclude 9 files that must never gain a literal heading (7 verbatim templates + 2 already-Codacy-excluded redirect stubs), while adding real `# Title` headings to the 7 remaining genuinely headingless files.

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)

## Shared contracts

None — the two agents touch disjoint files (`architect` edits only the root `.markdownlint.json`; `skill-writer` edits only the 7 headingless content files) and can work in parallel with no shared interface.
