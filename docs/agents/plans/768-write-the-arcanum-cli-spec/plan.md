# Plan: Write the arcanum CLI spec

Issue: [768-write-the-arcanum-cli-spec.md](../../issues/768-write-the-arcanum-cli-spec.md)

## Overview

Write the self-contained, forward-looking spec for the `arcanum` CLI (optional npm package `arcanum-cli`, command `arcanum`) as an index plus five parts, restating every decision from epic #767, and register it in `docs/agents/specs.md`. Docs only.

## Context

- The design was agreed in the body of epic #767 (sections: Description, Installation and distribution, Code location and ownership, The `client` agent, CLI entrypoint vs. existing `core/bin/arcanum`, Shared config logic, Targeting installs / accounts, Command surface, Split). That body is the input; once this issue merges, the spec is authoritative and #767 is a historical snapshot.
- Spec conventions: `docs/agents/specs.md` and `AGENTS.md` ("Specs (`docs/agents/specs/`)"): a large spec is an index `docs/agents/specs/<topic>.md` plus parts under `docs/agents/specs/<topic>/`; only the index is listed in `specs.md`.
- Shape precedent for the index: `docs/agents/specs/shell-engine-removal.md` (Status / Goal / … / Open points / See also).
- Every file must contain an **Alternatives considered** section and an **Open points** section; the open points are what #769–#774 will resolve.
- Facts to reference accurately: the three tier files and their resolution (`docs/agents/architecture/shared-state-and-configuration.md`), the internal dispatcher `core/bin/arcanum` and its registry `core/lib/core/commands.js` (`docs/agents/architecture/script-engine.md`), the shared config code `core/lib/utils/config/{ConfigChain,RepoConfig,RepoConfigWriter,BooleanKeyConfig}.js` and `core/lib/utils/file/Lock.js` (only non-built-in import: `DispatchFailure`), the release pipeline (`docs/agents/architecture/install-and-release.md`, `.circleci/config.yml`).

## Steps

- [01 — Write the index / overview](plan/01-write-the-index.md)
- [02 — Write command-surface.md](plan/02-command-surface.md)
- [03 — Write shortcuts-and-setup.md](plan/03-shortcuts-and-setup.md)
- [04 — Write key-registry.md](plan/04-key-registry.md)
- [05 — Write shared-config-logic.md](plan/05-shared-config-logic.md)
- [06 — Write packaging-and-release.md](plan/06-packaging-and-release.md)
- [07 — Register the spec in specs.md](plan/07-register-in-specs-index.md)

## Notes

- No code, no `cli/` folder, no `.claude/agents/client.md` (that is #775), no registry file (#777), no migration.
- Write decisions as decisions, not as discussion transcripts; keep each part focused on its own topic and cross-link instead of duplicating.
- Do not invent new design: anything not settled in #767 goes under the file's **Open points**.
- CI does not lint docs; verify relative links by hand (every link in the new files must resolve).
