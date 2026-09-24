# Plan: Migrate monitor-issues entrypoints to native Node.js

Issue: [586-migrate-monitor-issues-entrypoints-to-native-node-js.md](../../issues/586-migrate-monitor-issues-entrypoints-to-native-node-js.md)

## Overview

Move all 4 `monitor-issues` scripts (`config.sh`, `rewrite_queue.sh`, `github.sh`, `monitor_issues.sh`) to native Node.js in one PR. The scripter turns each script into a thin `engine_dispatch` shim plus per-subcommand `*_shell.sh` implementations, without changing any caller. The node agent adds the native commands. It generalizes `QueueStore` and pulls a shared config helper out of `AutoFixAllConfig`, then builds the poll loop so it calls issue-state and both queue pushes in-process.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

### Command names and native invocations

The 4 `false` keys in `arcanum/_lib/migration-status.json` are replaced by these 8 keys, all set to `true`:

| Command key | Shim → subcommand | Native invocation (`core/bin/arcanum ...`) | `commands.js` entry | Env allowlist |
| --- | --- | --- | --- | --- |
| `monitor-issues-config-get` | `config.sh get <key>` | `monitor-issues-config-get <cwd> <key>` | `MonitorIssuesConfig#get`, `context: 'none'` | — |
| `monitor-issues-config-is-enabled` | `config.sh is-enabled <key>` | `monitor-issues-config-is-enabled <cwd> <key>` | `MonitorIssuesConfig#isEnabled`, `'none'` | — |
| `monitor-issues-config-set` | `config.sh set <key> <true\|false>` | `monitor-issues-config-set <cwd> <key> <value>` | `MonitorIssuesConfig#set`, `'none'` | — |
| `monitor-issues-config-toggle` | `config.sh toggle <key>` | `monitor-issues-config-toggle <cwd> <key>` | `MonitorIssuesConfig#toggle`, `'none'` | — |
| `monitor-issues-rewrite-queue-push` | `rewrite_queue.sh push <id>` | `monitor-issues-rewrite-queue-push <cwd> <id>` | `MonitorIssuesRewriteQueue#push`, `context: 'repo'`, `validateRepoPath: false` | — |
| `monitor-issues-rewrite-queue-pop` | `rewrite_queue.sh pop` | `monitor-issues-rewrite-queue-pop <cwd>` | `MonitorIssuesRewriteQueue#pop`, `'repo'`, `validateRepoPath: false` | — |
| `monitor-issues-github-remove-tag` | `github.sh remove-tag <repo_path> <id> <tag>` | `monitor-issues-github-remove-tag <repo_path> <id> <tag>` | `MonitorIssuesGithub#removeTag`, `'repo'` | `HOME` |
| `monitor-issues-monitor-issues` | `monitor_issues.sh <repo_path>` | `monitor-issues-monitor-issues <repo_path>` | `MonitorIssuesMonitorIssues#run`, `'repo'` | `HOME` |

- `<cwd>` is the shim's `$PWD`. `config.sh` and `rewrite_queue.sh` keep their cwd-relative CLI with no `repo_path` argument. The shim passes `"$PWD"` as `engine_dispatch`'s `<repo_path>` together with `--prepend-repo-path`, so only the native side gets it as the leading positional. The `*_shell.sh` scripts keep today's argument list.
- `github.sh` and `monitor_issues.sh` already take `<repo_path>` first, so it goes in `<args...>` as usual. No `--prepend-repo-path` is needed.
- The remove-tag command is named `monitor-issues-github-remove-tag`, per subcommand like `auto-fix-all-github-remove-tag`. This follows the one-name-per-subcommand rule, even though `github.sh` has just one subcommand. The issue text's `monitor-issues-github` is superseded by this.

### stdout/stderr/exit-code parity (unchanged from today's shell)

- `config get` prints `<value>\n` (default `false`). `is-enabled` has no stdout and exits 0 or 1. `set` has no stdout. `toggle` prints the new value. Usage and validation errors go to stderr and exit 1, with the same messages as today.
- Config files: `clear_context` goes in `.claude/state/monitor-issues-config.json`. Every other key goes in `.claude/configuration/monitor-issues.json`. The lock is `.claude/state/monitor-issues-config.lock`.
- `rewrite-queue push <id>`: idempotent append, then prints `Pushed: <id>`. `pop` prints the id, or exits 1 with no output when the queue is empty. Files are `.claude/state/monitor-issues-rewrite-queue.{json,lock}`, with schema `[{"id":"<id>"}]`.
- Poll loop: the log format is `[<UTC ISO, seconds>] <message>`, with the same message texts as `monitor_issues.sh`. The cursor lives in `.claude/state/issue-monitor-last-checked.txt` and the lock in `.claude/state/issue-monitor.lock`.
