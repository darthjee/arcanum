# Plan: Add Discuss Issue Skill

Issue: [44-add-discuss-issue-skill.md](../issues/44-add-discuss-issue-skill.md)

## Overview

Create a new `discuss-issue` skill that mirrors `new-issue` but replaces the single comprehension check with an iterative dialogue loop, optionally spawning specialist agents to deepen understanding before writing the final issue file.

## Agents involved

- [architect](architect.md)
- [scripter](scripter.md)

## Shared contracts

The scripts folder is the shared interface between agents:

- `discuss-issue/scripts/github.sh` — GitHub operations script (copied verbatim from `new-issue/scripts/github.sh`). Commands: `info`, `fetch <id>`, `update <id> <title> <file>`, `create <title> <file>`.
- `discuss-issue/scripts/resolve_id_and_file.sh` — Resolves ID/title/filename from skill args (copied verbatim from `new-issue/scripts/resolve_id_and_file.sh`). Output: `SCENARIO`, `ID`, `TITLE`, `FILE`, `STATUS`, `NEEDS_FETCH`.

**Scripter must create these scripts before architect's steps can reference them.** However since both are copies, they can work in parallel — architect writes markdown referencing `scripts/github.sh` and `scripts/resolve_id_and_file.sh` (relative paths as `../scripts/github.sh` from inside steps/), which is the same convention used in `new-issue`.
