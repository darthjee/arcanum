# Issue: Promote the CLI install spec into architecture docs

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Every part of the [CLI Install spec](../specs/cli-install.md) is implemented (#862–#873). This issue moves the decisions that are still true into the permanent architecture docs. After that, the spec can be removed in #875. Docs only.

## Problem

The spec and its four parts are the only place that records:
- the contract of the shared client step, `arcanum/_lib/install_cli.sh`: its arguments, flags, env vars, exit codes and outcomes;
- how its callers use it: the installer, the zip updater, the `git clone` path in `bootstrap.sh`, `/arcanum-update` with the opt-in `FALLBACK=chat`, and the global migration `arcanum/migrations/repos/next/001.sh`.

The architecture docs point into the spec in three places:
- `arcanum-cli.md`'s `self-update` section calls the spec the source of truth for its messages, outcomes and failures;
- `install-and-release.md` links to `specs/cli-install/update.md`;
- `script-engine.md` links to the spec.

Removing the spec today would lose that design and break these links.

## Expected Behavior

- Every decision that is still true after implementation is in the architecture docs.
- The architecture docs no longer link into `docs/agents/specs/cli-install*`.
- In `docs/agents/specs.md`, the CLI Install row is marked as implemented and promoted. The row itself is removed in #875.

## Solution

- **New `docs/agents/architecture/cli-install.md`** (architect): the client step and its callers.
  - The contract of `arcanum/_lib/install_cli.sh`: its arguments, `--no-confirm`, `ARCANUM_SKIP_CLI`, `ARCANUM_CLI_PROMPT=chat`, and its exit codes `0`, `1` and `4`.
  - The shared rules and version pinning.
  - Detecting an installed client: `npm ls`, version comparison, a linked checkout, an unreadable install and a foreign `arcanum` on `PATH`.
  - Each caller: the installer, the zip updater, the `git clone` path in `bootstrap.sh`, `/arcanum-update` and the global migration `arcanum/migrations/repos/next/001.sh`, cited by that full path.
  - The backward-compatibility notes.
  - The Outcomes tables, copied with their exact wording (install, update, already-installed).
  - The alternatives considered that still explain the design.
  - Indexed in `docs/agents/architecture.md`.
- **`docs/agents/architecture/install-and-release.md`** (architect): the `Install` subsection and the `Update` section link to the new doc. The link to `specs/cli-install/update.md` is replaced.
- **`docs/agents/architecture/arcanum-cli.md`** (`client`):
  - The `self-update` section becomes the source of truth for its decisions, its Outcomes and Failures tables (exact wording) and exit code `8`.
  - It no longer defers to `specs/cli-install/self-update.md`.
- **`docs/agents/architecture/script-engine.md`** (architect): repoint the `install_cli.sh` plain-bash exception to the new doc.
- **`docs/agents/architecture/per-repo-migrations.md`** (architect): mention `next/001` as the global migration that installs the client, only if that adds something.
- **`docs/agents/specs.md`**: update the CLI Install row's status.

### Out of scope

- Removing the spec files and their `specs.md` row (#875).
- Repointing code comments that cite the spec (`arcanum/_lib/install_cli.sh`, `installer.sh`, `updater.sh`, `bootstrap.sh`, `next/001.sh`, their tests, `cli/lib/commands/selfUpdate.js`). This happens in #875, as #786 did after #785.
- Any behavior change.

## Benefits

The design survives the spec's removal. The architecture docs become the single source of truth for how arcanum installs and updates its CLI.
