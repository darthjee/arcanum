# Plan: Migrate arcanum-split-issue-create-sub-issue-file entrypoint to native Node.js

Issue: [257-migrate-arcanum-split-issue-create-sub-issue-file-entrypoint-to-native-node-js.md](../issues/257-migrate-arcanum-split-issue-create-sub-issue-file-entrypoint-to-native-node-js.md)

## Overview

Migrate `arcanum-split-issue/scripts/create_sub_issue_file.sh` to a native Node.js implementation, per `docs/agents/architecture/script-engine.md` and the pattern already applied in #250/#254/#255/#256. The shell script becomes a thin `engine_dispatch` wrapper delegating to a preserved `create_sub_issue_file_shell.sh`, while a new `core/lib/ArcanumSplitIssueCreateSubIssueFile.js` provides the byte-identical native counterpart, registered in `core/bin/arcanum` and covered by both unit and shell/native parity tests.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

`create_sub_issue_file_shell.sh <repo_path> <issue_id> <title> <body_file>` is the exact output/exit-code contract `node`'s native module must reproduce byte-for-byte:

- **Usage error** (any of the 4 args missing/empty): prints `Usage: $0 <repo_path> <issue_id> <title> <body_file>` to stderr, exits 1. (The native module's usage line reads `Usage: create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>`, matching the existing convention of naming the *wrapper* script in usage text — see `ArcanumSplitIssueFinish.js`'s `USAGE` constant.)
- **repo_path validation** — delegates to the same rules as `repo_path_enter` (`arcanum/_lib/repo_path.sh`), already available natively as `RepoPath#validate` (`core/lib/RepoPath.js`): reuse it rather than reimplementing.
  - Empty: `Error: repo_path is required` (stderr, exit 1)
  - Not a directory: `Error: not a directory: <repo_path>` (stderr, exit 1)
  - Not a git repo: `Error: not a git repository: <repo_path>` (stderr, exit 1)
- **Body file missing**: `Error: file not found: <body_file>` (stderr, exit 1).
- **Sub-issue counting** (gap-tolerant, mirrors `arcanum/migrations/generate_next.sh`): scans `docs/agents/issues/` for entries matching `<issue_id>_[0-9][0-9]*_*`, strips the `<issue_id>_` prefix, takes the leading digit run up to the next `_` as the count segment (non-numeric segments are skipped), and uses `1 + max(existing counts)` (or `1` if none exist) as the next count — a count freed by a deleted file is never reused. The count is zero-padded to 2 digits (`%02d`; counts beyond 99 are not zero-padded further, matching bash's `printf`).
- **Title-to-snake_case** (same transform as `ResolveIdAndFile.js`'s private `_titleToSnakeCase`, and identical to `title_to_snake_case()` in `arcanum/_lib/resolve_id_and_file.sh`): lowercase, `[^a-z0-9]` → `_`, collapse repeated `_` into one, trim leading/trailing `_`.
- **Output file**: `docs/agents/issues/<issue_id>_<count>_<snake_title>.md`, containing:
  ```
  # <title>

  <verbatim content of body_file>
  ```
  (title line, blank line, then the body file's bytes copied as-is — no trailing-newline normalization beyond what `cat`/file copy already does).
- **Success**: creates `docs/agents/issues/` if missing, writes the file, prints `FILE=<path>\n` to stdout, exits 0.

## CI Checks

- `core`: `make core-test` (CI job: `test`)
