# Plan: Scaffold docs/agents/specs.md from a canonical template in /init-claude

Issue: [932-scaffold-docs-agents-specs-md-from-a-canonical-template-in-init-claude.md](../../issues/932-scaffold-docs-agents-specs-md-from-a-canonical-template-in-init-claude.md)

## Overview

`/init-claude`'s `setup_docs_structure` (shell and native) gains two canonical templates under `init-claude/templates/`: `specs.md` (the specs index with an empty table) and `agents-documentation-section.md` (the `## Documentation` section appended to `AGENTS.md`, moved out of both implementations and extended with the specs index). Both implementations copy from these templates and never edit existing files. They add a stderr note for an existing `specs.md`, and a stderr warning when an existing Documentation section has no specs link. #933 (the per-repo migration) will read the same templates.

## Agents involved

- [scripter](scripter.md): templates, shell implementation, shim and implementation header comments.
- [node](node.md): native implementation, unit specs, parity specs.
- [skill-writer](skill-writer.md): `init-claude/setup_docs_structure.md`.

Order: scripter first (the templates are consumed by both implementations and the parity spec), then node and skill-writer.

## Shared contracts

### Templates (produced by scripter, consumed by shell and native)

- `init-claude/templates/specs.md` — byte-identical to arcanum's current `docs/agents/specs.md` except the `## Active specs` table keeps only its header and separator rows (`| Spec | Summary | Status |` / `| --- | --- | --- |`), with no data row. Ends with exactly one trailing newline. Copied byte-for-byte to `docs/agents/specs.md`.
- `init-claude/templates/agents-documentation-section.md` — the `## Documentation` section currently embedded in both implementations, **without** its leading blank line (the file starts with `## Documentation`), ending with exactly one trailing newline, plus:
  - a table row right after the `Issues` row: ``| [Specs](docs/agents/specs.md) | Index of every spec in `docs/agents/specs/`: forward-looking designs that guide future work, not yet implemented. |`` (same wording as arcanum's own `AGENTS.md`);
  - a ``### Specs (`docs/agents/specs/`)`` subsection after the `### Plans` subsection, copying arcanum's own `AGENTS.md` subsection verbatim except the example line, which becomes ``Example: `docs/agents/specs/user-authentication.md`.``
  - Appended to `AGENTS.md` as `"\n"` followed by the template bytes, which reproduces today's on-disk shape (blank line, then the section).

Both are resolved from the arcanum install: shell via `"${SCRIPT_DIR}/../templates/<name>"`, native via `resolveInstallPath('init-claude', 'templates', <name>)` (injectable as a `templatePath` dependency, like `InitClaudeSetupTemplates.js`). `setup_templates` copies an explicit file list, so these files never reach `.github/`.

### Behavior (shell and native must match byte-for-byte: stdout, stderr, exit code, files)

File order in the `Created:` / `Already existed (skipped):` lists:

1. `docs/agents/issues/.gitkeep`
2. `docs/agents/plans/.gitkeep`
3. `docs/agents/architecture.md`
4. `docs/agents/flow.md`
5. `docs/agents/issue-enhancement.md`
6. `docs/agents/arcanum-split-issue.md`
7. `docs/agents/specs.md` — new
8. `docs/agents/specs/.gitkeep` — new

Rules for the new entries:

- `docs/agents/specs.md`: if the path exists (`-e`), list it under skipped **and** write to stderr, at that point in the loop:
  `Note: docs/agents/specs.md already exists and was left untouched; compare it with init-claude/templates/specs.md if it is outdated.`
  Otherwise copy the template and list it under created.
- `docs/agents/specs/.gitkeep`:
  - `docs/agents/specs/.gitkeep` exists → listed under skipped (same as other files).
  - `docs/agents/specs` exists and is not a directory → not created, not listed; stderr:
    `Warning: docs/agents/specs exists and is not a directory — skipping docs/agents/specs/.gitkeep.`
  - `docs/agents/specs/` is a directory with at least one entry (hidden ones included) → not created, not listed, no message.
  - otherwise (missing or empty directory) → created (empty file plus newline, like the other `.gitkeep`s), listed under created.
- `AGENTS.md`:
  - missing → unchanged behavior (existing warning).
  - no `## Documentation` heading → append `"\n"` + `agents-documentation-section.md`; stdout `AGENTS.md: appended Documentation section` (unchanged).
  - `## Documentation` present → stdout `AGENTS.md: Documentation section already present (skipped)` (unchanged); additionally, if the file contains no `docs/agents/specs.md` substring anywhere, write to stderr:
    `Warning: AGENTS.md has a ## Documentation section with no link to docs/agents/specs.md — add the Specs row and the ### Specs subsection from init-claude/templates/agents-documentation-section.md.`

Stderr order: per-file notes/warnings in file-loop order, then the `AGENTS.md` warning (missing file, or missing specs link). Exit code stays `0`.
