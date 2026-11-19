# Issue: Scaffold docs/agents/specs.md from a canonical template in /init-claude

## Description

Part of Epic #931. Make `/init-claude` scaffold the specs index (`docs/agents/specs.md` and `docs/agents/specs/`) from a single canonical template, and make the `## Documentation` section it appends to `AGENTS.md` tell agents where the specs index is. #933 (the per-repo migration for existing repos) reads the same templates, so new and migrated repos converge.

## Problem

`/init-claude` Step 4 runs `init-claude/scripts/setup_docs_structure.sh`, which dispatches to the shell `setup_docs_structure_shell.sh` or the native `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js`. Both create `issues/.gitkeep`, `plans/.gitkeep`, and the `architecture.md`, `flow.md`, `issue-enhancement.md` and `arcanum-split-issue.md` placeholders, then append a `## Documentation` section to `AGENTS.md`. None of this creates or mentions the specs index, even though arcanum's own `AGENTS.md` documents it. The `## Documentation` text is also embedded twice (once in the shell implementation, once in the native one), so #933 has no single text it can reuse.

## Expected Behavior

- A fresh `/init-claude` run produces `docs/agents/specs.md` byte-identical to `init-claude/templates/specs.md`, under both engines.
- `docs/agents/specs/.gitkeep` is created when `docs/agents/specs/` is missing or empty, and only then.
- An existing `docs/agents/specs.md` (populated or incomplete) is never modified; it is listed under `Already existed (skipped):` on stdout as usual, and a `Note: ... compare with init-claude/templates/specs.md` line goes to stderr. Nothing points to `/arcanum-migrate`, because #933 never repairs an existing index either.
- A freshly appended `## Documentation` section in `AGENTS.md` includes the `Specs` table row and the `### Specs (docs/agents/specs/)` subsection.
- When `AGENTS.md` already has a `## Documentation` section without a link to `docs/agents/specs.md`, `AGENTS.md` is left untouched and a `Warning: AGENTS.md Documentation section has no link to docs/agents/specs.md — add ...` line on stderr names exactly what to add (the `Specs` row and the `### Specs` subsection, pointing to the template). Notes and warnings all go to stderr, so the stdout contract stays unchanged. This matters because Step 16 re-stamps the version pointers, which marks #933's `AGENTS.md` migration entry as satisfied on a re-run of `/init-claude`.
- Shell and native output stay byte-identical (parity spec).

### Edge cases

- `docs/agents/specs/` already contains files: create the index (no invented rows) and no `.gitkeep`.
- `docs/agents/specs` exists as a file: skip with a warning, never overwrite.
- `AGENTS.md` missing: the existing warning behavior is unchanged.

## Solution

- Add `init-claude/templates/specs.md`: the canonical header, the rules (writing specs, file layout, lifecycle) and an empty `| Spec | Summary | Status |` table.
- Move the `## Documentation` section text out of both implementations into `init-claude/templates/agents-documentation-section.md`, and add the `Specs` row and the `### Specs` subsection to it. The subsection copies arcanum's own `AGENTS.md` text except that the example becomes a neutral `docs/agents/specs/user-authentication.md` (arcanum's `shell-engine-removal.md` is project-specific).
- Both implementations read the templates instead of embedding them. Native resolves them through `resolveInstallPath('init-claude', 'templates', <name>)`, as `InitClaudeSetupTemplates.js` already does, and the shell implementation reads them relative to its script directory. The templates already ship in the release zip and in the Docker image (`COPY . $ARCANUM_ROOT`), and `setup_templates` copies an explicit file list, so the new files never leak into `.github/`.
- Update `init-claude/setup_docs_structure.md`, the shim's header comment, and both implementations' header comments to list the new files.
- Update `core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js` and `core/spec/bin/initClaudeSetupDocsStructureParity_spec.js` to cover the new files, the skip and warning paths, and the edge cases above.

### Out of scope

- Repairing an incomplete existing `specs.md`, or generating index rows for existing spec files.
- Keeping arcanum's own `docs/agents/specs.md` in sync with the template.
- Moving the other embedded placeholders (`architecture.md`, `flow.md`, `issue-enhancement.md`, `arcanum-split-issue.md`) into templates; nothing else reuses them.
- The per-repo migration (#933).

## Benefits

New repos start with the specs index in place, and agents can find it through `AGENTS.md`. A single template keeps new repos (#932) and migrated ones (#933) identical.
