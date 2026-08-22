# Plan: Migrate resolve-plan-paths entrypoint to native Node.js

Issue: [235-migrate-resolve-plan-paths-entrypoint-to-native-node-js.md](../issues/235-migrate-resolve-plan-paths-entrypoint-to-native-node-js.md)

## Overview

Migrate `arcanum/_lib/resolve_plan_paths.sh` to a native `core/lib/ResolvePlanPaths.js`, routed via `core/bin/arcanum resolve-plan-paths`, following the `#227`/PR #228 pattern (`core/lib/ResolveIdAndFile.js` is the closest existing reference). Unlike the other six migration targets in this batch, this script has no `engine_dispatch` shim yet, so this issue also builds that shim for the first time — which requires adding `repo_path` as a new leading argument and updating the 4 skills that call it.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)
- [skill-writer](skill-writer.md)

## Shared contracts

- **New signature (all call sites)**: `resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>` — `repo_path` is a new required leading arg, added purely to let the shim resolve `engine.mode` via `config_chain_read`, but also genuinely used (mirroring `resolve_id_and_file_shell.sh`'s exact pattern) to make `issues_folder`/`plans_folder` resolve correctly regardless of ambient cwd. Every caller passes all 4 positional args in this order:
  - **scripter**'s new shim (`arcanum/_lib/resolve_plan_paths.sh`) accepts and forwards them
  - **node**'s `core/bin/arcanum resolve-plan-paths` / `ResolvePlanPaths#run(repoPath, issuesFolder, plansFolder, id)` receives them in this order
  - **skill-writer**'s updated `steps/*.md` call sites pass `"$REPO_PATH" docs/agents/issues docs/agents/plans <id>`
- **Command/registry key**: `resolve-plan-paths` — used identically in `arcanum/_lib/migration-status.json` (scripter), `core/bin/arcanum`'s `COMMANDS` map (node), and `engine_dispatch`'s `<command>` arg (scripter's shim).
- **Output contract** (unchanged from today, byte-identical on both shell and native sides):
  ```
  ISSUE_FILE=<path>
  PLAN_DIR=<path>
  PLAN_FILE=<path>
  PLAN_EXISTS=true|false
  ```
  Error cases (stderr, exit 1): non-numeric id → `Error: issue id must be numeric and linked to a GitHub issue (got '<id>'). Local-only ids are no longer supported.`; no matching issue file → `Error: no issue file found for id <id>`.
- **`Usage:` guard stays shim-only**: `Usage: resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>` lives only in scripter's new `arcanum/_lib/resolve_plan_paths.sh` shim (checked before `engine_dispatch` even runs) — it is never reproduced in node's native class, the renamed shell implementation, or in any parity/unit test, matching the `resolve-id-and-file`/`list-agents` precedent.
- **Reuse target**: `core/lib/IssueFile.js`'s `IssueFile.findExisting(repoPath, issuesFolder, id)` already implements the exact `<id>_*`/`<id>-*` first-match glob this script needs — node's implementation must call it rather than reimplementing the lookup.
