# Plan: Update Docs

Issue: [36-update-docs.md](../issues/36-update-docs.md)

## Overview

Extend `docs/agents/architecture.md` with three new sections that document: (1) the shared JSON state and configuration files used by skills at runtime, (2) the lock system used to safely mutate shared files, and (3) the project's guiding principle of delegating logic to scripts rather than relying on inline AI reasoning. The folder-structure doc will also be updated to call out the `.claude/` subdirectories explicitly.

## Context

Skills like `auto-fix-all` and `auto-monitor-pr` rely on a set of shared JSON files (queue, comments state, CI-ignore config) and a file-based lock. None of these are currently documented, so future implementers either re-derive them from reading scripts or, worse, introduce incompatible formats. The "prefer scripts" principle is mentioned in AGENTS.md's Conventions section in Portuguese but never elevated to an explicit architectural guideline visible to English-reading agents.

## Implementation Steps

### Step 1 — Add "Shared State & Configuration Files" section to `docs/agents/architecture.md`

Append a new `## Shared State & Configuration Files` section (in English, consistent with the file's existing English headings) that documents each JSON file currently in use:

| File | Purpose | Schema |
|------|---------|--------|
| `.claude/state/auto-fix-all-queue.json` | Queue of issue IDs to be processed by `auto-fix-all`. First element is the in-progress entry. | `[{"id": "<issue_id>"}, ...]` |
| `.claude/state/auto-fix-all-queue.lock` | Lock file used during `push`/`pop` mutations to the queue. Contains the acquiring instance's ID. | Plain text (instance ID string) |
| `.claude/state/auto-monitor-pr-<pr_number>-comments.json` | Tracks owner comments seen by `auto-monitor-pr` for a given PR. One file per PR number. | `{"comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "status": "open"|"addressed"}], "last_comment_time": "<ISO8601>"}` |
| `.claude/configuration/auto-fix-all.json` | Configuration for the `auto-fix-all` skill. Currently controls which CI check names to ignore when deciding pass/fail. | `{"ignored_check_patterns": ["<substring>", ...]}` |

### Step 2 — Add "Lock System" section to `docs/agents/architecture.md`

Append a `## Lock System` section explaining:
- The lock file is `.claude/state/auto-fix-all-queue.lock`.
- Used by `queue.sh` `push` and `pop` commands to prevent concurrent mutations.
- Mechanism: write a unique instance ID into the lock file, sleep 1 s, re-read — if still matches, the lock is held; otherwise retry.
- Never gives up; after 10 failed attempts logs a warning (once) suggesting manual removal.
- Skills that mutate the queue must always go through `queue.sh push`/`queue.sh pop` — never write the queue JSON directly.
- If the lock file is left behind by a crashed process, it can be removed manually.

### Step 3 — Add "Script Preference" section to `docs/agents/architecture.md`

Append a `## Script Preference` section (in English) that promotes the principle already stated briefly in AGENTS.md:
- Deterministic logic (parsing, file mutation, API calls, validation) must live in shell scripts inside `<skill>/scripts/`, not in markdown instructions relying on AI judgment.
- Scripts are invoked from markdown steps with explicit arguments — no ambient reasoning needed.
- Benefits: reproducibility, reduced token use per run, easier testing.
- When adding a new skill or extending an existing one: if a step could be wrong in an edge case due to AI interpretation, extract it to a script.

### Step 4 — Update `docs/agents/folder-structure.md` to document `.claude/` subdirectories

The existing table entry for `.claude/` just says "Configuração local do Claude Code para este repositório." Expand it (or add sub-rows) to explicitly list:
- `.claude/state/` — runtime state files (queue JSON, lock file, per-PR comment tracking)
- `.claude/configuration/` — skill configuration files (e.g. `auto-fix-all.json`)

## Files to Change

- `docs/agents/architecture.md` — add three new sections: Shared State & Configuration Files, Lock System, Script Preference
- `docs/agents/folder-structure.md` — expand the `.claude/` entry to document `state/` and `configuration/` subdirectories

## Notes

- Write the new sections in English, consistent with the existing English headings already in `architecture.md`.
- Do not translate or change existing Portuguese content — only append new English sections.
- Keep the existing "Lógica determinística" paragraph in `architecture.md` as-is; the new "Script Preference" section is its English counterpart that goes into more detail.
