# Issue: Codacy: markdownlint MD040 — init-claude/setup_*.md (7 findings)

## Description

markdownlint MD040 flags fenced code blocks that have no language tag. Without one, renderers can't highlight the block, and readers (and agents) can't tell at a glance whether it is shell, Markdown, JSON or plain text. Severity Info.

**Source:** Codacy quality issues. Tool **markdownlint**, pattern `markdownlint_MD040`, category CodeStyle, severity **Info**. Snapshot taken on 2026-09-24 (commit `5107a41`). This is one of about 30 issues covering the worst open Codacy findings.

## Problem

Codacy reports 7 findings, one per file:

- `init-claude/setup_agents.md:24`
- `init-claude/setup_arcanum_split_issue.md:24`
- `init-claude/setup_architecture.md:63`
- `init-claude/setup_contributing.md:46`
- `init-claude/setup_folder_structure.md:64`
- `init-claude/setup_issue_enhancement.md:24`
- `init-claude/setup_specialist_dispatch_permissions.md:7`

Codacy only reports the **first** offending fence in each file. The same 7 files actually contain **15** bare opening fences. No other `init-claude/*.md` file has any. Fixing only the 7 reported lines would expose the next fence in each file on the following Codacy run.

| File | Bare opening fences (line) | Content |
|------|----------------------------|---------|
| `setup_agents.md` | 24, 130, 163 | prompts / confirmation message to the user |
| `setup_arcanum_split_issue.md` | 24, 38 | prompts / confirmation message |
| `setup_architecture.md` | 63, 80 | prompts / confirmation message |
| `setup_contributing.md` | 46, 71 | prompts / confirmation message |
| `setup_contributing.md` | 63 | Markdown table row for `AGENTS.md` |
| `setup_folder_structure.md` | 64 | Markdown table row for `AGENTS.md` |
| `setup_folder_structure.md` | 72 | confirmation message |
| `setup_issue_enhancement.md` | 24, 38 | prompts / confirmation message |
| `setup_specialist_dispatch_permissions.md` | 7 | prompt to the user |

## Expected Behavior

- Codacy reports zero `markdownlint_MD040` findings for these 7 files, including on the run after the fix.
- `.markdownlint.json` stays unchanged, and the rendered Markdown looks the same.
- The text inside each fenced block stays unchanged. Only the opening fence's info string changes.

## Solution

Add an info string to all 15 bare opening fences in the 7 files:

- `text` for prompts and messages shown to the user (13 fences). This matches the existing `text` prompt blocks earlier in the same files, and the convention used by the sibling fixes (#616–#619).
- `markdown` for the two `AGENTS.md` table-row snippets (`setup_contributing.md:63`, `setup_folder_structure.md:64`).

Owner: the `skill-writer` agent (these are `init-claude` skill step files). No script or logic changes.

## Benefits

- Clears the 7 Codacy findings without new ones appearing in the same files on the next run.
- Makes it clear in these step files which blocks are user-facing prompts and which are Markdown snippets.
