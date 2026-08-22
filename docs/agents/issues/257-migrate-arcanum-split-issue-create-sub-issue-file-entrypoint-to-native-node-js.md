Sub-issue of #252 (batch overview). Part of the `arcanum-split-issue` family.

## Source script

`arcanum-split-issue/scripts/create_sub_issue_file.sh`

Creates one local sub-issue draft file for a parent issue being split: scans `docs/agents/issues/<id>_[0-9][0-9]*_*` for existing sub-issue files to determine the next zero-padded, gap-tolerant count, snake_cases the title, and writes `docs/agents/issues/<id>_<count>_<snake_title>.md`.

## Migration

Follow `docs/agents/architecture/script-engine.md`:

1. Read `arcanum-split-issue/scripts/create_sub_issue_file.sh` for its exact output/exit-code contract.
2. Create `core/lib/ArcanumSplitIssueCreateSubIssueFile.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'arcanum-split-issue-create-sub-issue-file': { module: 'ArcanumSplitIssueCreateSubIssueFile.js', method: 'run' }`.
4. Add `"arcanum-split-issue-create-sub-issue-file": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/ArcanumSplitIssueCreateSubIssueFile_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

None — pure local filesystem and string operations (title-to-snake-case transform, directory scan). No GitHub API calls, no shared `arcanum/_lib/*.sh` helper beyond `repo_path.sh` (cwd resolution).

## Dependencies on other sub-issues

None — no in-batch script calls this one or is called by it.
