# Node Plan: Migrate init-claude setup-docs-structure to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- You consume `init-claude/scripts/setup_docs_structure_shell.sh` (produced by scripter) in the parity spec, run directly with no args.
- You register command `init-claude-setup-docs-structure` → `{ module: 'commands/init-claude/InitClaudeSetupDocsStructure.js', method: 'run', context: 'repo', validateRepoPath: false }`.
- You must reproduce the output contract in [plan.md](plan.md) byte for byte, resolving every path against `RepoContext.repoPath` and never against `process.cwd()`.

## Steps

- [01 — Implement InitClaudeSetupDocsStructure](node/01-implement-command.md)
- [02 — Register the command](node/02-register-command.md)
- [03 — Unit and parity specs](node/03-specs.md)

## CI Checks
- `core/`: `make core-test` (CI job: tests with coverage) and `make core-lint` (CI job: Lint).

## Notes
- Zero runtime deps: `node:fs/promises` and `node:path` only.
- Copy the placeholder contents and the `AGENTS.md` heredoc byte for byte from the shell script, including the backticks, the em dash in the warning, and the leading blank line of the appended section. The parity spec is the safety net.
