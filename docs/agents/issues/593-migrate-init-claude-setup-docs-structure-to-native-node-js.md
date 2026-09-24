# Issue: Migrate init-claude setup-docs-structure to native Node.js

## Description

Sub-issue B of #585. Migrate the `init-claude-setup-docs-structure` entrypoint (`init-claude/scripts/setup_docs_structure.sh`, 137 lines) to native Node.js. Run from the target project root, it creates the `docs/agents/` skeleton (`issues/.gitkeep`, `plans/.gitkeep`, and placeholder `architecture.md`, `flow.md`, `issue-enhancement.md`, `arcanum-split-issue.md`), skipping any path that already exists, and appends the standard `## Documentation` section to `AGENTS.md` when no line starts with `## Documentation`.

It is the last of the three cwd-based `init-claude` entrypoints still on shell: #592 already migrated `setup-templates`, `set-ci-ignored-patterns` and `stamp-arcanum-version`, so that is the direct precedent.

## Expected Behavior

The command routes through `engine_dispatch`. Stdout, stderr, exit codes and the resulting files are identical in `engine.mode=native` and `shell`, including the created folders and files, their exact bytes (each file is written with `printf '%s\n'`, so the `.gitkeep` files hold a single newline), the `AGENTS.md` content and idempotency on re-run. Its `migration-status.json` key flips to `true`.

### Output contract to preserve

- stdout, in this order, each block only when non-empty: `Created:` followed by `  <path>` lines, then `Already existed (skipped):` followed by `  <path>` lines. Both lists follow the fixed creation order.
- Then one `AGENTS.md:` line: `appended Documentation section` or `Documentation section already present (skipped)`. There is no line when `AGENTS.md` is missing.
- When `AGENTS.md` is missing: `Warning: AGENTS.md not found — skipping Documentation section append.` on stderr, still exit 0.
- The existing-section check is a line-anchored prefix match on `^## Documentation`, so a heading like `## Documentation Guide` also counts as present. Keep that.
- Any existing path (file or directory) counts as "exists" (`[[ -e ]]`) and is skipped.
- Extra arguments are ignored today and must stay ignored.

### Constraints

- It runs from the target project root (cwd) and takes no `<repo_path>` argument. Follow the #592 precedent: the shim passes the literal `$PWD` (not `git rev-parse --show-toplevel`) as `engine_dispatch`'s `<repo_path>` with `--prepend-repo-path`, and the command uses `context: 'repo'`. Native code reads `RepoContext.repoPath` and never `process.cwd()`.
- There is no env-var allowlist. The command needs no `HOME`, `gh` or GitHub access.
- The parity spec must cover a fresh repo, a re-run on an already set-up repo, a partially set-up repo (some files present), and a repo without `AGENTS.md`.

## Solution

Follow `docs/agents/architecture/script-engine.md`, mirroring #592 (`init-claude/scripts/setup_templates.sh` + `setup_templates_shell.sh` + `core/lib/commands/init-claude/InitClaudeSetupTemplates.js`).

1. **scripter:** move the current implementation verbatim into `init-claude/scripts/setup_docs_structure_shell.sh`. Make `setup_docs_structure.sh` a thin `engine_dispatch` shim modeled on `setup_templates.sh`: `REPO_PATH="$PWD"`, `engine_dispatch "$REPO_PATH" init-claude-setup-docs-structure "${SCRIPT_DIR}/setup_docs_structure_shell.sh" --prepend-repo-path -- "$@"`, with no env allowlist. Also fix the stale header comment, which leaves out `docs/agents/arcanum-split-issue.md` from the list of created files.
2. **node:** implement `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js` with zero runtime deps. Keep the placeholder file contents and the `AGENTS.md` Documentation section as byte-identical constants. Write the missing-`AGENTS.md` warning directly to stderr, as other native commands do (e.g. `shared/GithubIssueMark.js`).
3. Register the command in `core/lib/core/commands.js` with `context: 'repo'`.
4. In `arcanum/_lib/migration-status.json`, set `init-claude-setup-docs-structure` to `true`, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
5. Add a native unit spec (`core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js`) and a shell-vs-native parity spec covering the scenarios listed under Constraints.
6. Verify `engine_dispatch.sh` routing under both `engine.mode=native` and `shell`.

### Out of scope

- Content changes to the generated files or the `AGENTS.md` section. For example, the section links to `docs/agents/folder-structure.md`, which this command never creates. That is existing behavior, kept for parity.

## Benefits

Finishes the cwd-based `init-claude` entrypoints under #585. Only `sync-labels` and `write-label-config` remain on shell.
