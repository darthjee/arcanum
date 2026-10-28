# Plan: Promote the CLI install spec into architecture docs

Issue: [874-promote-the-cli-install-spec-into-architecture-docs.md](../../issues/874-promote-the-cli-install-spec-into-architecture-docs.md)

## Overview

Docs only. Move the implemented [CLI Install spec](../../specs/cli-install.md) and its parts into the architecture docs.

- `architect` writes a new `docs/agents/architecture/cli-install.md` with the client step (`arcanum/_lib/install_cli.sh`) and its callers. It also repoints the architecture docs that link into the spec, and updates the spec's status in `docs/agents/specs.md`.
- `client` makes `arcanum-cli.md`'s `self-update` section the source of truth for that command.

The spec files, their `specs.md` row and the code comments that cite the spec stay until #875.

## Agents involved

- [architect](architect.md)
- [client](client.md)

## Shared contracts

- **New doc path:** `docs/agents/architecture/cli-install.md`, title `# CLI Install`.
- **Anchors in the new doc that `client` links to:**
  - `#shared-rules`: the shared rules section, which includes the list of rules `self-update` overrides.
  - `#version-pinning`
- **Anchor in `arcanum-cli.md` that `architect` links to:** `#self-update`. The section keeps its `## \`self-update\`` heading.
- Neither doc copies the other's content. The new doc only links to `arcanum-cli.md#self-update` for the CLI command. `arcanum-cli.md` only links to `cli-install.md` for the shared installer and updater rules.
