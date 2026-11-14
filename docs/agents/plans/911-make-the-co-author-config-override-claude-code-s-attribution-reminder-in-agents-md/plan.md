# Plan: Make the co-author config override Claude Code's attribution reminder in AGENTS.md

Issue: [911-make-the-co-author-config-override-claude-code-s-attribution-reminder-in-agents-md.md](../../issues/911-make-the-co-author-config-override-claude-code-s-attribution-reminder-in-agents-md.md)

## Overview

A new native-only command, `init-claude-ensure-coauthor-policy`, appends one fixed co-author line to a repo's `AGENTS.md` when the line is missing. init-claude calls it through a new setup step, and a new `next` repo-scoped migration calls it for existing repos. arcanum's own AGENTS.md and the config guide get the line and a mention.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)
- [skill-writer](skill-writer.md)
- [architect](architect.md)

## Shared contracts

**Command:** `init-claude-ensure-coauthor-policy` (native-only, `context: 'repo'`, registered in `core/lib/core/commands.js`).

**Shim:** `init-claude/scripts/ensure_coauthor_policy.sh <repo_path>`. It calls `engine_dispatch "$REPO_PATH" init-claude-ensure-coauthor-policy "" --native-only -- "$REPO_PATH"`. A missing argument prints usage on stderr and exits 1.

**Policy line**, exact text, a single line:

```text
Commit co-author trailers follow arcanum's resolved `git.omit_model_coauthor` and `git.remove_coauthors` config (check them with `/arcanum-check-config`); this overrides Claude Code's own attribution reminder for every commit, including ones written by hand.
```

**Behavior** (on `<repo_path>/AGENTS.md`):

- No AGENTS.md: write nothing. Print `COAUTHOR_POLICY=no-agents-md`, exit 0.
- AGENTS.md already contains the exact policy line: write nothing. Print `COAUTHOR_POLICY=present`, exit 0.
- Otherwise, append to the end of the file. Make sure there is exactly one blank line before the appended block, and end with a trailing newline. The block is:

  ```text
  ## Commit Attribution

  <policy line>
  ```

  Then print `COAUTHOR_POLICY=added`, exit 0.
- Unexpected I/O errors: `arcanum: <message>` on stderr, exit 1.

**migration-status.json:** `"init-claude-ensure-coauthor-policy": "docker"` (repo mount only, like `init-claude-set-next-step-clear`).

**Migration:** `arcanum/migrations/repos/next/004.sh` plus `004.md`, with the entry `{"id":"004","type":"script","file":"004.sh","skippable":true,"applies_to":"repo"}` in `next/migrations.json`.
- `config` prints `{"skippable": true}`.
- `run` calls the shim with `"$PWD"` (the migration runner's cwd is the target repo). It resolves the shim from its own location: `${SCRIPT_DIR}/../../../../init-claude/scripts/ensure_coauthor_policy.sh`.
