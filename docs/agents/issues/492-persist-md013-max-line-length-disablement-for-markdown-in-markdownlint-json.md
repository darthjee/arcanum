# Issue: Persist MD013 (max line length) disablement for Markdown in .markdownlint.json

## Description

Codacy's "Enforce Maximum Line Length" check is markdownlint's MD013 rule, scoped to Markdown files. In Codacy's cloud pattern settings for this repo (`darthjee/arcanum`), MD013 is currently disabled (confirmed via `codacy_list_repository_tool_patterns` with `enabled=true`, which returned 43 enabled patterns with MD013 absent).

## Problem

The repo's checked-in `.markdownlint.json` only overrides `MD024` (`{"MD024": {"siblings_only": true}}`) and does not mention `MD013` at all. The disablement decision therefore exists solely in Codacy's cloud configuration, not in the repository itself, which means it is invisible during code review, not reproducible by anyone running markdownlint locally, and fragile — it could be silently reset if Codacy's pattern settings are ever reconfigured. As a direct consequence, Codacy still lists 67 stale open issues for `markdownlint_MD013` (most recent from commit 2026-09-15), flagging long-line documentation prose across files such as `AGENTS.md`, `.claude/agents/*.md`, and various `SKILL.md` / `steps/*.md` files — content this repo intentionally writes with long, descriptive lines.

## Expected Behavior

- `.markdownlint.json` explicitly disables MD013, matching what Codacy's cloud pattern settings already enforce.
- Running markdownlint locally with the repo config no longer flags long lines in Markdown files.
- A subsequent Codacy re-analysis clears the 67 previously stale `markdownlint_MD013` issues.

## Solution

Add an explicit `"MD013": false` entry to `.markdownlint.json`, alongside the existing `MD024` override, so the rule disablement is durable and reviewable in-repo instead of living only in Codacy's cloud UI.

## Benefits

- Makes the line-length exemption for Markdown durable and visible in code review instead of hidden in Codacy's cloud settings.
- Keeps local markdownlint runs consistent with what Codacy actually enforces.
- Clears 67 stale Codacy issues without further per-file cleanup.
