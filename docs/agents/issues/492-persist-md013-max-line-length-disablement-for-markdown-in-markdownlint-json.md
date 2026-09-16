# Persist MD013 (max line length) disablement for Markdown in .markdownlint.json

## Context

Codacy's "Enforce Maximum Line Length" check is markdownlint's MD013 rule, scoped to Markdown
files. Today, MD013 is disabled only through Codacy's cloud UI pattern settings for this repo
(`darthjee/arcanum`) — confirmed via `codacy_list_repository_tool_patterns` with `enabled=true`,
which returned 43 enabled patterns with MD013 absent from the list.

However, the repo's checked-in `.markdownlint.json` only overrides MD024
(`{"MD024": {"siblings_only": true}}`) and does not mention MD013 at all. This means the
disablement decision exists solely in Codacy's cloud configuration, not in the repository, so it
is invisible during code review, not reproducible by anyone running markdownlint locally, and
fragile — it could be silently reset if Codacy's pattern settings are ever changed or the repo is
reconfigured.

Because of this gap, Codacy still lists 67 stale open issues for `markdownlint_MD013` (most
recent from commit 2026-09-15), flagging long-line documentation prose across files such as
`AGENTS.md`, `.claude/agents/*.md`, and various `SKILL.md` / `steps/*.md` files — content this
repo intentionally writes with long, descriptive lines.

## What needs to be done

- Add an explicit `"MD013": false` (or equivalent disable) entry to `.markdownlint.json`,
  alongside the existing `MD024` override, so the rule disablement is durable, reviewable in-repo,
  and matches what Codacy's cloud settings already enforce.
- Verify that a subsequent Codacy re-analysis clears the 67 stale `markdownlint_MD013` issues now
  that the local config matches the cloud pattern settings.

## Acceptance criteria

- [ ] `.markdownlint.json` explicitly disables MD013 (e.g. `"MD013": false`) in addition to the
      existing `MD024` override.
- [ ] The change is consistent with Codacy's cloud pattern settings for this repo, where MD013 is
      not among the enabled markdownlint patterns.
- [ ] Codacy re-analysis after the change clears the previously stale `markdownlint_MD013` issues.
