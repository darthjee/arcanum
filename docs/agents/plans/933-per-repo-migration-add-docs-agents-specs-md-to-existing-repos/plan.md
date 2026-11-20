# Plan: Per-repo migration: add docs/agents/specs.md to existing repos

Issue: [933-per-repo-migration-add-docs-agents-specs-md-to-existing-repos.md](../../issues/933-per-repo-migration-add-docs-agents-specs-md-to-existing-repos.md)

## Overview

Add two pending per-repo migration entries under `arcanum/migrations/repos/next/`: a `script`
entry that copies `init-claude/templates/specs.md` to `docs/agents/specs.md` and creates
`docs/agents/specs/.gitkeep` (mirroring `init-claude/scripts/setup_docs_structure_shell.sh`'s
checks), and an `instructions` entry that adds the specs index to the target repo's `AGENTS.md`
Documentation section. `scripter` writes the migration files; `node` writes the contract spec for
the `script` entry.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Ids:** obtained from `arcanum/migrations/generate_next.sh`, `script` first, then
  `instructions`. With `next/migrations.json` currently `[]` these are `001` and `002`;
  if another migration lands first, both agents use the real ids `scripter` reports.
- **Manifest entry for the script** (in `next/migrations.json`), exactly:
  `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "repo"}`.
  The `instructions` entry: `{"id": "002", "type": "instructions", "description_file": "002.md",
  "instructions_file": "002.instructions.md", "skippable": true, "applies_to": "repo"}`.
  `generate_next.sh` scaffolds `applies_to: "local"`; it must be edited to `"repo"` for both.
- **`001.sh config`** prints exactly `{"skippable": true}` + newline, exit 0.
- **`001.sh run`** (cwd = target repo), always exit 0:
  - `docs/agents/specs.md` absent (`! -e`) → `mkdir -p docs/agents`, `cp` the template
    (byte-identical), stdout `Created: docs/agents/specs.md`.
  - `docs/agents/specs.md` present (`-e`, any type) → untouched, stdout
    `Already present, left untouched: docs/agents/specs.md`.
  - `docs/agents/specs/.gitkeep` present → nothing.
  - `docs/agents/specs` exists and is not a directory → stderr
    `Warning: docs/agents/specs exists and is not a directory — skipping docs/agents/specs/.gitkeep.`
  - `docs/agents/specs/` non-empty per `ls -A` (hidden entries count) → nothing.
  - otherwise → create empty `docs/agents/specs/.gitkeep`, stdout
    `Created: docs/agents/specs/.gitkeep`.
- **Template path** resolved relative to the script:
  `${SCRIPT_DIR}/../../../../init-claude/templates/specs.md` (same as
  `arcanum/migrations/repos/0.14.0/001.sh`).
