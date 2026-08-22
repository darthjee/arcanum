# Issue: Migrate arcanum-split-issue-create-sub-issue entrypoint to native Node.js

## Description
Migrate the `arcanum-split-issue-create-sub-issue` entrypoint (`arcanum-split-issue/scripts/create_sub_issue.sh`) from its current bash implementation to a native Node.js implementation, following the migration pattern defined in `docs/agents/architecture/script-engine.md` and already applied to sibling entrypoints (`arcanum-split-issue-create-sub-issue-file`, `arcanum-split-issue-finish`, `auto-fix-all-reply-comment`, `auto-fix-all-cleanup-artifacts`).

Sub-issue of #252 (batch overview), part of the `arcanum-split-issue` family.

## Problem
`create_sub_issue.sh` creates ONE sub-issue on GitHub from a local sub-issue draft file, links it to the parent as a native GitHub sub-issue, and tracks it in `.claude/state/issue-<issue_id>.json`. It parses the title/body from the draft file, then delegates the create + label + link work to `arcanum/_lib/spawn_issue.sh --as-subissue`, and finally appends the new id to state via `arcanum/_lib/issue_state.sh append-json`.

Both of those dependencies are already migrated (`core/lib/SpawnIssue.js`, the `spawn-issue` command; `core/lib/IssueState.js`, the `issue-state` command), but `create_sub_issue.sh` itself still only runs as bash — so `engine.mode=native` cannot yet be used for sub-issue creation. The sibling script `push_sub_issues.sh` also cannot be migrated yet, since it directly invokes `create_sub_issue.sh` and depends on this migration landing first.

## Expected Behavior
A native `core/lib/ArcanumSplitIssueCreateSubIssue.js` implementation exists, registered under the `arcanum-split-issue-create-sub-issue` command in `core/bin/arcanum`'s `COMMANDS` map. Given the same inputs (`<repo_path> <issue_id> <sub_issue_file>`), it is byte-identical to the shell script in stdout and exit code: parses title/body from the sub-issue draft file (title = first line with a leading `# ` stripped; body = everything after the first blank line), creates the sub-issue by calling the native `SpawnIssue` class in-process (mirroring `--as-subissue`), and records the new id in `.claude/state/issue-<issue_id>.json` via the native `IssueState` class — no shelling out to either dependency. Selectable via the existing `engine.mode` config key per `docs/agents/architecture/script-engine.md`.

## Solution
Follow `docs/agents/architecture/script-engine.md`:

1. Read `arcanum-split-issue/scripts/create_sub_issue.sh` for its exact output/exit-code contract (`STATUS=ok` / `ID=<new_id>` on success, exit 0; `STATUS=failed`, exit 1, when `spawn_issue.sh` exhausts its retry budget).
2. Create `core/lib/ArcanumSplitIssueCreateSubIssue.js` (zero runtime deps, built-in Node APIs only), importing and calling the native `SpawnIssue` and `IssueState` classes directly in-process instead of shelling out.
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'arcanum-split-issue-create-sub-issue': { module: 'ArcanumSplitIssueCreateSubIssue.js', method: 'run' }`.
4. Set `"arcanum-split-issue-create-sub-issue": true` in `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/ArcanumSplitIssueCreateSubIssue_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## Benefits
- Enables `engine.mode=native` for sub-issue creation.
- Unblocks the sibling `arcanum-split-issue-push-sub-issues` migration, which depends on this one landing first since `push_sub_issues.sh` directly invokes `create_sub_issue.sh`.
- Continues the incremental shell-to-native migration tracked by #168/#189, reusing the already-migrated `SpawnIssue` and `IssueState` native modules instead of duplicating their logic.
