# Plan: Remove the CLI install spec

Issue: [875-remove-the-cli-install-spec.md](../../issues/875-remove-the-cli-install-spec.md)

## Overview

#874 promoted the CLI install spec into `docs/agents/architecture/cli-install.md` and the `self-update` section of `docs/agents/architecture/arcanum-cli.md`. This plan deletes the spec (`docs/agents/specs/cli-install.md` plus its four parts), removes its `docs/agents/specs.md` row, and repoints the 11 code comments in 10 files that still cite it. Only comments change in code; no behavior changes. It follows the arcanum CLI spec removal (#786).

## Agents involved

- [architect](architect.md): deletes the spec, edits `specs.md`, repoints comments in the files no specialist owns (`arcanum/install/`, `arcanum/update/`, `arcanum/migrations/repos/next/001.sh`), and runs the final grep check.
- [scripter](scripter.md): repoints comments in `arcanum/_lib/install_cli.sh` and `arcanum/_lib/test_install_cli.sh`.
- [client](client.md): repoints the comment in `cli/lib/commands/selfUpdate.js`.

## Shared contracts

Old citation → new citation. Comments cite the doc by repo-relative path and name the section in quotes, e.g. `docs/agents/architecture/cli-install.md, "Callers" → "Installer"`.

| Old citation | New citation |
|---|---|
| `docs/agents/specs/cli-install.md` (and "its parts install.md / already-installed.md / update.md") | `docs/agents/architecture/cli-install.md` ("The shared script"; "An already-installed client" where the comment is about detection) |
| `docs/agents/specs/cli-install/install.md` | `docs/agents/architecture/cli-install.md`, "Callers" → "Installer" |
| `docs/agents/specs/cli-install/update.md` in `updater.sh` / `test_updater.sh` | `docs/agents/architecture/cli-install.md`, "Callers" → "Zip updater" |
| `docs/agents/specs/cli-install/update.md` in `bootstrap.sh` / `test_update_bootstrap.sh` | `docs/agents/architecture/cli-install.md`, "Callers" → "`git clone` path" |
| `docs/agents/specs/cli-install/update.md`, "Global migration" | `docs/agents/architecture/cli-install.md`, "Callers" → "Global migration" |
| `docs/agents/specs/cli-install/self-update.md` | `docs/agents/architecture/arcanum-cli.md#self-update` (already cited next to it) |

These section names exist today in `docs/agents/architecture/cli-install.md` (`## The shared script`, `## An already-installed client`, `## Callers` with `### Installer (...)`, `### Zip updater (...)`, `### \`git clone\` path (...)`, `### Global migration`). Nobody edits the architecture docs in this issue.

Final check (architect, after everyone is done), excluding the historical folders:

```bash
grep -rn "specs/cli-install" . --exclude-dir=node_modules --exclude-dir=.git | grep -v "^./docs/agents/issues/\|^./docs/agents/plans/"
```

It must print nothing. Also `grep -rn "cli-install/" arcanum cli` must print nothing (catches bare part names like `cli-install/install.md`).
