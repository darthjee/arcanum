# Plan: Migrate issue-state entrypoint to native Node.js

Issue: [238-migrate-issue-state-entrypoint-to-native-node-js.md](../issues/238-migrate-issue-state-entrypoint-to-native-node-js.md)

## Overview

Migrate `arcanum/_lib/issue_state.sh` (safe, lock-protected read/write of `.claude/state/issue-<id>.json`) to native Node.js, following the `checkout-safe-branch`/`resolve-plan-paths` migration pattern from #233/#235. `core/lib/IssueState.js` already has a `write` method (used by `GithubIssue.js.fetch`); this plan extends it with the four CLI subcommands (`get`, `set`, `set-json`, `append-json`), wires the shell shim, updates the migration-status registry/doc, and adds parity + unit test coverage.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)
- [architect](architect.md)

## Shared contracts

- **Command name**: `issue-state`, matching the `arcanum/_lib/migration-status.json` key and the `core/bin/arcanum` `COMMANDS` registry key.
- **CLI argument order** (repo_path first, matching the shell script's own order — not command-first): native and shell both accept
  ```
  <repo_path> get <id> <field>
  <repo_path> set <id> <field> <value>
  <repo_path> set-json <id> <field> <json_value>
  <repo_path> append-json <id> <field> <json_value>
  ```
  scripter's shim forwards these args unchanged to `core/bin/arcanum issue-state <repo_path> <subcommand> <id> <field> [value]`; node's `IssueState#run(repoPath, subcommand, id, field, value)` dispatches internally on `subcommand`.
- **Shell fallback filename**: `arcanum/_lib/issue_state_shell.sh` (scripter creates it by extracting `issue_state.sh`'s current body; node's parity test invokes it directly, never through the shim, to avoid circularity).
- **Output/exit-code contract** (byte-identical between shell and native, verified by node's parity test):
  - `get`: prints the field's value, or empty string if missing/absent — always exit 0.
  - `set`/`set-json`/`append-json`: exit 0, no stdout.
  - Missing required args: usage message to stderr, exit 1.
  - Unknown subcommand: `Unknown command: <command>` + usage to stderr, exit 1.
  - JSON merge semantics: `set` → `.[$field] = $value` (string); `set-json` → `.[$field] = $value` (parsed JSON); `append-json` → `.[$field] = ((.[$field] // []) + [$value])`.
- **Sequencing**: architect's `migration-status.json` flip (`issue-state`: `false` → `true`) must land only after node's `IssueState.js`/`core/bin/arcanum` changes and scripter's shim are both in place and passing — flipping it earlier would route production traffic to a nonexistent/incomplete native path.
