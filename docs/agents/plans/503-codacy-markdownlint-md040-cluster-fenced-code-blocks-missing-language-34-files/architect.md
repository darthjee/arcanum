# architect Plan: Codacy: markdownlint MD040 cluster — fenced code blocks missing language (34 files)

Main plan: [plan.md](plan.md)

## Shared contracts

Change the bare ` ``` ` opening fence at each flagged line to ` ```text `, and nothing else. Every block below was inspected and confirmed to be an ASCII tree, a path/log snippet, a structured report template, or a settings-permission snippet — not an executable command — so `text` is correct for all of them.

## Implementation Steps

### Step 1 — Add `text` to the flagged opening fence in each of the 7 root-level/docs files

For each file below, open it at the given line and change that line's ` ``` ` to ` ```text `. Leave the matching closing fence (plain ` ``` `) as-is.

## Files to Change

- `README.md:103` — opening fence for the skill-folder ASCII tree diagram
- `docs/agents/architecture/overview-and-layout.md:11` — opening fence for the skill-folder ASCII tree diagram (near-duplicate of README.md's)
- `AGENTS.md:63` — opening fence for the `docs/agents/issues/<issue_id>_<issue_name>.md` path pattern
- `docs/guides/arcanum-global-config.md:10` — opening fence for the `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` path
- `docs/guides/arcanum-repo-config.md:5` — opening fence for the legacy-config warning log line
- `.claude/agents/skill-reviewer.md:35` — opening fence for the violation-report template
- `docs/agents/architecture/dispatch-permissions.md:65` — opening fence for the `Bash(...)` settings-permission snippet

## Notes

- `README.md:103` and `docs/agents/architecture/overview-and-layout.md:11` show the same folder-tree diagram in two places; fix both independently, they are not generated from a shared source.
- `docs/agents/architecture/dispatch-permissions.md:65`'s block lists `Bash(...)` permission-pattern strings (as they appear in `.claude/settings.json`), not runnable shell — `text` is correct, not `bash`/`json`.
