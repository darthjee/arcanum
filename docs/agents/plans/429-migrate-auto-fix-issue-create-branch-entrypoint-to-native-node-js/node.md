# Node Plan: Migrate auto-fix-issue-create-branch entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Overview
`auto-fix-issue/scripts/create_branch.sh` (`create_branch.sh <repo_path> <plan_dir> <id>`) still runs as bash. Per `docs/agents/architecture/script-engine.md`, split it into a preserved shell implementation plus a thin `engine_dispatch` shim, add a native `AutoFixIssueCreateBranch` command behind `core/bin/arcanum`, register it, flip its migration-status flag, and cover it with native unit + shell/native parity tests — mirroring the already-completed `auto-fix-issue-commit-change` migration (#428).

## Context
The script creates or checks out the branch defined in an implementation plan:
- Reads `<plan_dir>/plan.md` and looks for a `## Branch` section to determine the branch name (the line right after the heading, backticks/whitespace stripped).
- Falls back to `issue-<id>` if the plan file doesn't exist, has no `## Branch` section, or the extracted name is empty.
- Checks out the branch if it already exists locally (`git show-ref --verify --quiet refs/heads/<branch>`), otherwise creates it (`git checkout -b <branch>`).
- Prints the resulting branch name to stdout (single line); `<plan_dir>` is resolved relative to `<repo_path>`.

No GitHub API calls are involved, and no other sub-issue in the #427 batch depends on this one or is depended on by it.

## Steps

- [01 — Split the shell script](node/01-split-shell-script.md)
- [02 — Create the native command](node/02-create-native-command.md)
- [03 — Register the command](node/03-register-command.md)
- [04 — Flip the migration-status flag](node/04-migration-status-flag.md)
- [05 — Native unit tests](node/05-native-unit-tests.md)
- [06 — Parity test](node/06-parity-test.md)

## CI Checks
- `core/`: `make core-check` (CI jobs: `test`, `checks`)

## Notes
- Confirm during implementation whether `create_branch.sh`'s `engine_dispatch` shim needs any explicit env-var allowlist entries (like `commit_change.sh`'s `HOME`, needed there for `git commit`'s identity resolution). `create_branch.sh` never commits, so it may need none beyond `engine_dispatch.sh`'s own defaults — verify against real `git show-ref`/`git checkout` behavior rather than assuming.
- Keep every `git` call to `execFile`/`spawn` with an argument array, never string-interpolated `exec()`, per script-engine.md's security requirements.
- The native/shell output contract must stay byte-identical: same single-line branch name on stdout, same exit codes.
