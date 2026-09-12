# Plan: Migrate discuss-issue-confirm entrypoint to native Node.js

Issue: [447-migrate-discuss-issue-confirm-entrypoint-to-native-node-js.md](../issues/447-migrate-discuss-issue-confirm-entrypoint-to-native-node-js.md)

## Overview

Migrate `discuss-issue/scripts/confirm.sh` — a pure, dependency-free string-normalization script that resolves a free-form reply to yes/no purely via exit code, with no stdout in either outcome — to a native `core/lib/` module, following the same rename-to-`_shell.sh`-plus-thin-shim pattern used throughout this migration (most recently #435/#436). Unlike every commit-style entrypoint migrated so far, this one takes no `<repo_path>` argument and touches no git/GitHub/filesystem state, so it follows the context-less, no-env-allowlist precedent set by `auto-fix-issue-list-plan-agents` (#431) rather than the `auto-fix-issue-commit-change`-style precedent.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name**: `discuss-issue-confirm` — used verbatim as (a) the `arcanum/_lib/migration-status.json` key, (b) the `<command>` argument scripter's shim passes to `engine_dispatch`, (c) the `COMMANDS` map key node adds to `core/lib/core/commands.js`, and (d) the subcommand node's parity test invokes via `core/bin/arcanum discuss-issue-confirm`. All four must match exactly, character for character.
- **Shell implementation path**: scripter renames the current script to `discuss-issue/scripts/confirm_shell.sh` (content unchanged). Node's parity test must invoke this exact path directly — never through the new `discuss-issue/scripts/confirm.sh` shim, which would make the parity test circular.
- **No `context` key, no env allowlist, no `<repo_path>` argument**: node's `COMMANDS` map entry omits `context` entirely (`'none'`/absent, per `auto-fix-issue-list-plan-agents`'s precedent, not `'repo'`). Scripter's shim forwards no environment variables (mirroring `list_plan_agents.sh`'s "no env vars forwarded" shape) and derives `REPO_PATH` for its own `engine_dispatch` call via `git rev-parse --show-toplevel` rather than threading a new positional argument through the script's three existing callers (`arcanum-split-issue/steps/split.md`, `discuss-issue/steps/discuss_and_save.md`, `init-claude/setup_labels.md`), all of which call `confirm.sh "<reply>"` with no repo path today.
- **Silent exit-only contract, including on a missing argument**: `confirm_shell.sh` never writes to stdout or stderr in either outcome — a missing/empty reply falls through the same normalization path as an explicit "no" and exits 1 exactly like any other non-affirmative reply, with **no** usage-error message. This means node's module must **not** follow the usual "throw a plain `Error(USAGE)` on a missing required argument" pattern used by almost every other migrated entrypoint (that path prints `arcanum: <message>` to stderr, which `confirm.sh` never does) — see `node.md`'s Step 1 for the exact idiom to use instead (`AutoFixAllConfig.isEnabled`'s `DispatchFailure('', 1)` precedent), and scripter's shim must **not** add its own pre-dispatch argument-presence check (see `scripter.md`'s Step 1).
