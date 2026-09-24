# Plan: Migrate init-claude setup-docs-structure to native Node.js

Issue: [593-migrate-init-claude-setup-docs-structure-to-native-node-js.md](../../issues/593-migrate-init-claude-setup-docs-structure-to-native-node-js.md)

## Overview

Move `init-claude/scripts/setup_docs_structure.sh` behind a thin `engine_dispatch` shim (implementation moved verbatim into `setup_docs_structure_shell.sh`) and add a native `init-claude-setup-docs-structure` command whose stdout, stderr, exit code and resulting files are byte-identical to the shell version. This mirrors #592 (`setup_templates.sh` / `InitClaudeSetupTemplates.js`, commit f5f5979) exactly, then flips the command's `migration-status.json` key to `true`.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name:** `init-claude-setup-docs-structure` (already present as `false` in `arcanum/_lib/migration-status.json`).
- **Shell implementation path:** `init-claude/scripts/setup_docs_structure_shell.sh`, the current script body moved verbatim with no behavior change. The native parity spec runs it directly (via `runInitClaudeBoth({ script: 'setup_docs_structure', ... })`), with `cwd` set to the project dir and no arguments.
- **Dispatch shape:** `engine_dispatch "$PWD" init-claude-setup-docs-structure "${SCRIPT_DIR}/setup_docs_structure_shell.sh" --prepend-repo-path -- "$@"`. The native side receives `<repoPath>` as its leading positional; the Dispatcher strips it into `RepoContext.repoPath`. There is no env-var allowlist.
- **Registry entry:** `{ module: 'commands/init-claude/InitClaudeSetupDocsStructure.js', method: 'run', context: 'repo', validateRepoPath: false }`.
- **Output contract** (both sides must match byte for byte):
  - The files are handled in this fixed order: `docs/agents/issues/.gitkeep`, `docs/agents/plans/.gitkeep`, `docs/agents/architecture.md`, `docs/agents/flow.md`, `docs/agents/issue-enhancement.md`, `docs/agents/arcanum-split-issue.md`. Each missing path is created as `<content>\n` (so a `.gitkeep` is exactly `\n`), with parent dirs created as needed. Any existing path (file or directory, `[[ -e ]]`) is skipped.
  - `AGENTS.md` is a regular file (`[[ -f ]]`) with no line matching `^## Documentation`: the fixed section heredoc is appended, starting with a blank line. When `AGENTS.md` is not a regular file: stderr gets `Warning: AGENTS.md not found — skipping Documentation section append.\n`.
  - stdout: `Created:\n` + `  <relative path>\n` per created path (only if any were created), then `Already existed (skipped):\n` + `  <relative path>\n` per skipped path (only if any), then `AGENTS.md: appended Documentation section\n` or `AGENTS.md: Documentation section already present (skipped)\n`. There is no `AGENTS.md:` line when the file is missing.
  - Exit 0. Arguments are ignored.
