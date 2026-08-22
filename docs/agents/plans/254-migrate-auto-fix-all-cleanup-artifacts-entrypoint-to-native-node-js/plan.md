# Plan: Migrate auto-fix-all-cleanup-artifacts entrypoint to native Node.js

Issue: [254-migrate-auto-fix-all-cleanup-artifacts-entrypoint-to-native-node-js.md](../issues/254-migrate-auto-fix-all-cleanup-artifacts-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-fix-all/scripts/cleanup_artifacts.sh` (removes the issue file + plan dir once a PR is approved, committing/pushing if anything was staged) to a native Node.js implementation behind the existing `engine_dispatch` guard, following the same shim/native split already used for issues #236–#239.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name**: `auto-fix-all-cleanup-artifacts` — the exact string used both as the `arcanum/_lib/migration-status.json` key (scripter) and the `core/bin/arcanum` `COMMANDS` map key (node). Must match verbatim.
- **CLI argument order** (unchanged from the shell script, minus `repo_path` which becomes `ARCANUM_REPO_PATH` under native, per `engine_dispatch`'s existing convention): `<issue_file> <plan_dir> <id> <model_name> <model_email>`.
- **Env allowlist**: the shim must forward `HOME` — needed for `git commit`/`git push` to resolve the committer's git identity from `~/.gitconfig`, the same reason `spawn-issue`'s shim forwards it. No other env vars are required (this entrypoint makes no GitHub API calls).
- **Output/exit-code contract** (must be byte-identical between shell and native):
  - Nothing staged (issue file/plan dir untracked or already absent): no stdout, exit 0.
  - Something staged: commit it, push the current branch, no stdout, exit 0.
  - A missing/empty required argument: usage message on stderr, exit 1.
- **Commit message is hardcoded, not templated** — `arcanum/_lib/commit_template.sh`/`agent_email.sh` are NOT used here (unlike `commit_plan.sh`/`commit_issue.sh`):
  ```
  chore(docs): remove planning artifacts (issue #<id>)

  Co-Authored-By: <model_name> <model_email>
  Co-Authored-By: architect agent <model_email>
  ```
  Node's implementation must reproduce this exact format; scripter's shim/migration-status.json change does not alter it.
