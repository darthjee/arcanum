# Issue: Remove the CLI install spec

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum). This is the epic's last sub-issue.

#874 promoted the CLI install spec into the architecture docs:

- `docs/agents/architecture/cli-install.md` (shared rules, version pinning, the shared script, an already-installed client, callers, outcomes);
- the `self-update` section of `docs/agents/architecture/arcanum-cli.md`.

The spec files are now redundant. This issue removes them and repoints every remaining reference to them. It follows the same pattern as the arcanum CLI spec removal (#786).

## Problem

`docs/agents/specs/cli-install.md` and its four parts under `docs/agents/specs/cli-install/` (`install.md`, `update.md`, `already-installed.md`, `self-update.md`) duplicate content that now lives in the architecture docs, so the two copies can drift. `docs/agents/specs.md` still lists the spec, marked "Implemented; promoted … (removal: #875)".

The architecture docs no longer link into the spec, but code comments in 10 files do. Deleting the spec leaves them pointing at paths that no longer exist:

- `cli/lib/commands/selfUpdate.js` (cites `self-update.md`);
- `arcanum/_lib/install_cli.sh` and `arcanum/_lib/test_install_cli.sh` (cite `cli-install.md`);
- `arcanum/install/installer.sh` (two comments) and `arcanum/install/test_installer.sh` (cite `install.md`);
- `arcanum/update/updater.sh` (two comments), `arcanum/update/bootstrap.sh`, `arcanum/update/test_updater.sh` and `arcanum/update/test_update_bootstrap.sh` (cite `update.md`);
- `arcanum/migrations/repos/next/001.sh` (cites `update.md`, "Global migration").

## Expected Behavior

- `docs/agents/specs/cli-install.md` and `docs/agents/specs/cli-install/` no longer exist.
- `docs/agents/specs.md` no longer has the CLI Install row. Its intro and the Shell Engine Removal row are unchanged.
- No file outside the historical `docs/agents/issues/` and `docs/agents/plans/` folders references `specs/cli-install`. The check is `grep -rn "specs/cli-install" . --exclude-dir=node_modules --exclude-dir=.git`, excluding those two folders, and it returns nothing.
- Each repointed comment names the architecture section that now holds the same content, so the comment's meaning is unchanged.
- Code is unchanged apart from comments. The bash tests and the `cli/` lint and specs still pass.

## Solution

### Architect

- `git rm -r docs/agents/specs/cli-install.md docs/agents/specs/cli-install/`.
- Remove the CLI Install row from `docs/agents/specs.md`.
- Sweep the markdown docs for any remaining `specs/cli-install` links. None are known today, because #874 already repointed them.
- Run the final grep check across the repo.

### Repointing code comments, by owner

Each owner repoints the comments in its own files. Only the comment text changes. Suggested targets:

| Old citation | New citation |
|---|---|
| `specs/cli-install.md` | `docs/agents/architecture/cli-install.md` ("The shared script" for `install_cli.sh`) |
| `specs/cli-install/install.md` | `docs/agents/architecture/cli-install.md`, "Callers" → "Installer" |
| `specs/cli-install/update.md` | `docs/agents/architecture/cli-install.md`, "Callers" → "Zip updater" or "`git clone` path", whichever the file is |
| `specs/cli-install/update.md`, "Global migration" | `docs/agents/architecture/cli-install.md`, "Callers" → "Global migration" |
| `specs/cli-install/self-update.md` | `docs/agents/architecture/arcanum-cli.md`, "`self-update`" |

- `client`: `cli/lib/commands/selfUpdate.js`.
- `scripter`: `arcanum/_lib/install_cli.sh` and `arcanum/_lib/test_install_cli.sh`.
- The installer, updater and migration files (`arcanum/install/`, `arcanum/update/`, `arcanum/migrations/repos/next/001.sh`): whoever the plan assigns them to. No specialist explicitly owns these folders, so `scripter` (bash) or `architect` are both fine.

`arcanum/migrations/repos/next/001.sh` is a pending migration. Editing its comment does not change its behavior or its version.

### Out of scope

- Any behavior change in the scripts or the CLI.
- Rewriting the architecture docs. #874 already settled their content.
