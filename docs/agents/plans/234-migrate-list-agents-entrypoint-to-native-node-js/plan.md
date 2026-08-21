# Plan: Migrate list-agents entrypoint to native Node.js

Issue: [234-migrate-list-agents-entrypoint-to-native-node-js.md](../../issues/234-migrate-list-agents-entrypoint-to-native-node-js.md)

## Overview

Migrates `arcanum/_lib/list_agents.sh` to a native Node.js implementation, following the shell/native split already established by #227/#233: the current implementation becomes `list_agents_shell.sh`, a new thin `engine_dispatch` shim takes over the `list_agents.sh` name, and a native `core/lib/ListAgents.js` (routed via `core/bin/arcanum list-agents`) implements the same `<name>|<description>` frontmatter-listing contract, verified byte-identical by a parity test.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **CLI contract both sides must match exactly** (this is what the parity test asserts):
  - Invocation: `<repo_path> [agents_dir]` (`agents_dir` optional, defaults to `.claude/agents` relative to `repo_path`).
  - Output: one line per agent, `<name>|<description>`, ordered alphabetically by the agent file's filename (not by `name` field), parsed from each `*.md` file's YAML frontmatter (`name:`/`description:` fields, surrounding single/double quotes stripped — a plain single-line field extraction, not a full YAML parser, matching `list_agents_shell.sh`'s existing `awk` logic). Files with no `name` field are skipped entirely (no blank-name line).
  - Empty output + exit 0 when `agents_dir` doesn't exist or contains no `*.md` files.
  - Missing/invalid `repo_path`: message to stderr, exit 1 — same messages as `RepoPath.js`'s `validate()` (`node`'s side) already produces, since native `list-agents` reuses that helper directly rather than duplicating repo-path validation logic.
- **`migration-status.json` key**: `"list-agents"`. `node` must land a working, tested native implementation *before* `scripter` flips this key to `true` — flipping it first would make `engine_dispatch.sh` route real callers (`discuss-issue`, `plan-issue`, `auto-plan-issue`) to an unfinished native path whenever `engine.mode=native` is configured.
- **`core/bin/arcanum` `COMMANDS` registry key**: `'list-agents': { module: 'ListAgents.js', method: 'run' }` — `node` adds this entry; `scripter`'s shell shim invokes the entrypoint by this same `list-agents` command name via `engine_dispatch`.
