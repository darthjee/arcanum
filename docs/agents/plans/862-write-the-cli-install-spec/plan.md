# Plan: Write the CLI install spec

Issue: [862-write-the-cli-install-spec.md](../../issues/862-write-the-cli-install-spec.md)

## Overview

Write the forward-looking spec for epic #861: an index, `docs/agents/specs/cli-install.md`, plus four part skeletons under `docs/agents/specs/cli-install/`. Register the index in `docs/agents/specs.md` with status `Proposed`. Docs only. This pass records #861's decisions and adds no new design.

## Context

- Epic #861 agreed on the design: install and update `arcanum-cli` together with arcanum, pin to the arcanum version, use a separate `[Y/n]` prompt, add `ARCANUM_SKIP_CLI`, add an opt-in `FALLBACK=chat` for `/arcanum-update`, warn and continue on failure, never downgrade, add `arcanum self-update`, and add a global skippable migration.
- The spec supersedes the epic body as the source of truth. #863–#866 enhance one part each.
- Shape precedent: the index follows `docs/agents/specs/shell-engine-removal.md`, and the parts follow #768's lighter shape (Purpose / Decisions / Alternatives considered / Open points).
- Relevant existing docs to link: `docs/agents/architecture/install-and-release.md`, `docs/agents/architecture/arcanum-cli.md`, `docs/agents/architecture/per-repo-migrations.md`, `docs/guides/arcanum-cli.md`, `README.md` (Installation, Updating).

## Steps

- [01 — Write the index](plan/01-write-the-index.md)
- [02 — Write the four part skeletons](plan/02-write-the-part-skeletons.md)
- [03 — Register the spec and check links](plan/03-register-and-check-links.md)

## Notes

- Do not change `install-and-release.md` here; the "no migration installs it" rule changes in #872.
- No code, scripts, migration files or `cli/` changes.
- Every file ends with an **Open points** section seeded from the issue's "Open points to seed".
