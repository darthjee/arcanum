# Plan: Enhance spec: update.md (CLI install)

Issue: [864-enhance-spec-update-md-cli-install.md](../../issues/864-enhance-spec-update-md-cli-install.md)

## Overview

Docs only. Turn `docs/agents/specs/cli-install/update.md` from its skeleton into a complete design, following the issue's Solution section, then sync the index (`docs/agents/specs/cli-install.md`) and `docs/agents/specs/cli-install/install.md` with the rules this issue moves into the shared rules. No script, skill or migration changes: those belong to #868, #870, #871 and #872.

## Context

Part of epic #861. The spec index and its parts are the source of truth for the design. #862 wrote the skeleton and #863 completed `install.md`, whose shape (Decisions, Flow, Outcomes, Testing strategy, Alternatives considered, Open points) this part follows.

The issue settles `update.md`'s three open points:

- the git-clone path calls the shared script from #868 (for example `arcanum/_lib/install_cli.sh`) from the checked-out tree, with no separate script;
- `/arcanum-update` resumes through `run_update.sh install-cli <version>`, which calls the shared script with `--no-confirm`;
- the migration id is `next/001`.

It also fixes the names (`ARCANUM_SKIP_CLI`, `ARCANUM_CLI_PROMPT=chat`, `--no-confirm`, `FALLBACK=chat` + `CLI_VERSION=<v>`, `install-cli`) and adds the performance and security rules (plain-semver validation, `npm i -g --ignore-scripts`, consent only through a command-line argument, bounded `npm view`).

## Implementation Steps

### Step 1 — Complete `update.md`

Rewrite `docs/agents/specs/cli-install/update.md`, keeping its header paragraph and Purpose. Follow `install.md`'s section order:

- **Decisions:**
  - **Zip updater.** The client step is the last step of `updater.sh`, after the `arcanum updated to <v> at <target>` line and before `cleanup`. It calls the shared script from `$TARGET`. The target is `arcanum-cli@$VERSION`.
  - **Git-clone path.** `bootstrap.sh` calls `$TARGET/arcanum/_lib/<shared script>` after `git checkout` and the "updated" line. If the checked-out tree has no such script, it skips silently.
  - **No-op updates.** `Already on <v>.` runs no client step, on both paths.
  - **`/arcanum-update`.**
    - `run_update_apply` sets `ARCANUM_CLI_PROMPT=chat`, in both the shell and the native `ArcanumUpdateRunUpdate.js` implementation.
    - With no TTY, the shared script runs its checks first. Only if an install or update would happen does it print `FALLBACK=chat` and `CLI_VERSION=<v>` and exit `4`.
    - `updater.sh` and `bootstrap.sh` propagate the exit `4`.
    - `run_update_apply` prints `RESULT=updated FROM=... TO=...` after those lines and exits `4`.
    - The skill asks Yes / No / Chat with `AskUserQuestion`. Yes runs `run_update.sh install-cli <version>`, which calls the shared script with `--no-confirm`. No prints the manual command.
    - An old skill (no flag) gets the no-TTY skip and exit `0`.
  - **Migration `next/001`.**
    - The manifest entry is `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "global"}`.
    - The target version comes from `arcanum.json`'s `.version`, or else `git describe --tags --exact-match`. If neither resolves, it warns and skips.
    - `[R]un` (or All) is the consent, and the migration calls the shared script with `--no-confirm`.
    - It always exits `0`, and never downgrades (see `already-installed.md`).
    - The `install-and-release.md` rule changes with #872.
  - **Exit code.** The update exits `0` whatever the client outcome, except the opt-in exit `4`.
- **Flow:** a numbered flow for each of the zip path, the git path, the `/arcanum-update` resume and the migration. Cite `next/001` as one string literal, per the per-repo-migrations convention.
- **Outcomes:** the table from the issue (update applied, already on version, exit `4` with the flag, flag set but nothing to do, old skill, git tree without the script, migration with an unresolvable version). Link to `install.md`'s Outcomes for the per-client-step rows.
- **Names:** the table from the issue (`ARCANUM_SKIP_CLI`, `ARCANUM_CLI_PROMPT=chat`, `--no-confirm`, `FALLBACK=chat`/`CLI_VERSION=`, `run_update.sh install-cli <version>`).
- **Testing strategy:** the bats tests for `updater.sh` and the `bootstrap.sh` git path, using a stub shared script that records its calls; the shell and native specs for `run_update_apply` and `install-cli`; the bats tests for the migration's version resolution and the pre-answer; and `skill-reviewer` for the skill's exit `4` branch.
- **Alternatives considered:** keep the three existing entries and add those from the issue:
  - a separate git-path script;
  - running the client step on `Already on`;
  - the skill re-running the whole update;
  - a second `[Y/n]` in the migration;
  - letting npm run install scripts;
  - `--yes` as the pre-answer name;
  - `ARCANUM_CLI_FALLBACK=chat`;
  - an env var as the pre-answer.
- **Open points:** "None left in this part", pointing to the index for the prompt and warning wording, as in `install.md`.

### Step 2 — Sync the index and `install.md`

- `docs/agents/specs/cli-install.md`:
  - Add the security and performance rules to **Shared rules**:
    - plain-semver validation before any `npm` call;
    - `npm i -g --ignore-scripts arcanum-cli@<v>` as a single quoted argument;
    - an exact pin;
    - the pre-answer only through `--no-confirm`, never an env var, with `ARCANUM_SKIP_CLI` only able to skip;
    - `npm view` with `--fetch-retries=0` and a bounded `--fetch-timeout`, whose timeout means "network error, warn and skip";
    - the user's npm config honored, with no registry override;
    - the fork note.
  - State the final names: `ARCANUM_SKIP_CLI` takes any non-empty value, and `ARCANUM_CLI_PROMPT=chat` is no longer a placeholder.
  - Make the Migration section cite `next/001`.
  - Remove the env var names from **Open points**, leaving only the prompt and warning wording.
- `docs/agents/specs/cli-install/install.md`:
  - Flow step 5.7 becomes `npm i -g --ignore-scripts arcanum-cli@<version>`.
  - The Outcomes table gains an "Invalid version" row (`VERSION` is not plain semver: warning, no `npm` call, exit `0`).
  - Its Open points line stops listing the env var names.
- Check that every relative link in the three files resolves.

## Files to Change

- `docs/agents/specs/cli-install/update.md`: complete the part (Step 1).
- `docs/agents/specs/cli-install.md`: shared rules, names, migration id, open points (Step 2).
- `docs/agents/specs/cli-install/install.md`: `--ignore-scripts`, the invalid-version row, open points (Step 2).

## Notes

- Do not touch `arcanum/update/`, `arcanum-update/`, `core/` or `arcanum/migrations/`, and do not change `docs/agents/architecture/install-and-release.md`. Those are #868, #870, #871 and #872.
- `already-installed.md` (#865) is out of scope. This part only links to it for the already-installed and never-downgrade cases.
- The shared script's file name (`arcanum/_lib/install_cli.sh`) is still an example, owned by #868. Write it as "the shared client-step script (#868)", with the example name in parentheses.
- Owner: `architect` (docs only).
