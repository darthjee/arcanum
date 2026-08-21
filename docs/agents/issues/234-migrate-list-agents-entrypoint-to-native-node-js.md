# Issue: Migrate list-agents entrypoint to native Node.js

## Description

Continues the migration batch tracked in #232 (following #192, #193, #227, #233): migrates `arcanum/_lib/list_agents.sh` to a native Node.js implementation, following the same shell-to-native pattern already established for prior entrypoints.

**Target script**: `arcanum/_lib/list_agents.sh` — lists specialist agents configured in a project.

**Usage**: `list_agents.sh <repo_path> [agents_dir]` (default `agents_dir` is `.claude/agents`, relative to `repo_path`)

**Output contract**:
- One line per agent: `<name>|<description>`, ordered alphabetically by filename, parsed from each `*.md` file's YAML frontmatter (`name:` and `description:` fields, quotes stripped) — matching the shell version's simple single-line field extraction, not a full YAML parser.
- Prints nothing and exits 0 if `agents_dir` doesn't exist or has no `*.md` files.
- Missing/invalid `repo_path`: error to stderr, exit 1.

References: parent #232 · migration design: `docs/agents/architecture/script-engine.md` · previous migrations: #192, #193, #227, #233.

## Solution

- Native implementation at `core/lib/ListAgents.js`, routed via `core/bin/arcanum list-agents` (add an entry to the `COMMANDS` registry in `core/bin/arcanum`).
- Repo-path validation reuses `core/lib/RepoPath.js`'s `validate()`, already introduced by #233 — no new validation helper is needed. (This issue's original dependency note about `repo_path.sh`'s `repo_path_enter` having "no native equivalent yet" is now stale: `RepoPath.js` landed with #233.)
- Byte-identical output/exit-code to `list_agents.sh` (same `<name>|<description>` line format, same alphabetical-by-filename ordering, same silent-empty behavior, same exit codes).
- Parity test at `core/spec/lib/ListAgents_spec.js` — runs shell vs. native with identical inputs (including this repo's own `.claude/agents/*.md` files), asserts identical stdout + exit code.
- Unit tests for frontmatter edge cases: missing `name`/`description`, quoted values, files with no frontmatter, empty/missing `agents_dir`.
- Flip `list-agents` from `false` to `true` in `arcanum/_lib/migration-status.json`.
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
- Zero runtime npm dependencies — only built-in Node APIs.

## Benefits

- Continues the shell-to-native migration batch (#232), keeping the pattern consistent across entrypoints.
- Replaces `awk`-based frontmatter parsing with native, unit-testable Node.js code.
- Reuses the shared `RepoPath` validation helper introduced by #233, avoiding duplicated repo-path-validation logic.
