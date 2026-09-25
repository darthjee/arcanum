# Skill-writer Plan: Codacy: markdownlint MD040 — init-claude/setup_*.md (7 findings)

Main plan: [plan.md](plan.md)

## Overview

Tag every bare opening fence (```` ``` ```` on its own) in the 7 flagged `init-claude` step files with `text` or `markdown`, so markdownlint MD040 passes for the whole file, not just the line Codacy reported.

## Context

Codacy reports only the first MD040 finding in each file. The 7 files hold 15 bare opening fences in total. No other `init-claude/*.md` file has any. Earlier prompt blocks in the same files already use ````text````, and the sibling fixes (#616–#619) used the same convention.

## Implementation Steps

### Step 1 — Add info strings to the 15 bare opening fences

Change only the opening fence line. Leave block contents, closing fences and surrounding prose as they are. Line numbers refer to `origin/main` at `0975a35`:

| File | Line | Info string | Block content |
|------|------|-------------|---------------|
| `init-claude/setup_agents.md` | 24 | `text` | "Which agents should this project have…" prompt |
| `init-claude/setup_agents.md` | 130 | `text` | "These are the proposed agents…" prompt |
| `init-claude/setup_agents.md` | 163 | `text` | ".claude/agents/ written:" confirmation |
| `init-claude/setup_arcanum_split_issue.md` | 24 | `text` | "Anything else to add, remove, or reword?" |
| `init-claude/setup_arcanum_split_issue.md` | 38 | `text` | "docs/agents/arcanum-split-issue.md is set…" |
| `init-claude/setup_architecture.md` | 63 | `text` | "This is the proposed docs/agents/architecture.md…" |
| `init-claude/setup_architecture.md` | 80 | `text` | "docs/agents/architecture.md written." |
| `init-claude/setup_contributing.md` | 46 | `text` | "This is the proposed docs/agents/contributing.md…" |
| `init-claude/setup_contributing.md` | 63 | `markdown` | `AGENTS.md` table row for Contributing |
| `init-claude/setup_contributing.md` | 71 | `text` | "docs/agents/contributing.md written…" |
| `init-claude/setup_folder_structure.md` | 64 | `markdown` | `AGENTS.md` table row for Folder Structure |
| `init-claude/setup_folder_structure.md` | 72 | `text` | "docs/agents/folder-structure.md written." |
| `init-claude/setup_issue_enhancement.md` | 24 | `text` | "Anything else to add, remove, or reword?" |
| `init-claude/setup_issue_enhancement.md` | 38 | `text` | "docs/agents/issue-enhancement.md is set…" |
| `init-claude/setup_specialist_dispatch_permissions.md` | 7 | `text` | "Would you like to grant…" [y/n] prompt |

## Files to Change

- `init-claude/setup_agents.md` — 3 fences → `text`
- `init-claude/setup_arcanum_split_issue.md` — 2 fences → `text`
- `init-claude/setup_architecture.md` — 2 fences → `text`
- `init-claude/setup_contributing.md` — 2 fences → `text`, 1 → `markdown`
- `init-claude/setup_folder_structure.md` — 1 fence → `markdown`, 1 → `text`
- `init-claude/setup_issue_enhancement.md` — 2 fences → `text`
- `init-claude/setup_specialist_dispatch_permissions.md` — 1 fence → `text`

## Notes

- Do not change `.markdownlint.json`.
- CI does not run markdownlint, so check locally, e.g. `npx markdownlint-cli2 "init-claude/setup_*.md"`, and confirm there are no MD040 findings. Other rules' findings (if any) are out of scope.
- Closing fences must stay bare. Afterwards, a quick awk pass that toggles open/closed state on each fence line should find zero bare *opening* fences in these 7 files.
- If line numbers have drifted, find the fences by their block content from the table.
