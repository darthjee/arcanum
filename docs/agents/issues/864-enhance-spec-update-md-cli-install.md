# Issue: Enhance spec: update.md (CLI install)

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Enhance `docs/agents/specs/cli-install/update.md` from its skeleton into a complete design that an implementation issue can follow without reopening #861. Docs only.

### Covers

- The zip updater (`arcanum/update/updater.sh`): the client step after reconciling files.
- The `git clone` path in `arcanum/update/bootstrap.sh`: calling the client step from the *checked-out* tree after `git checkout`. The first update after the release still runs the old `bootstrap.sh` and skips the client, so users get a one-time manual pointer.
- `/arcanum-update`: the opt-in flag (for example `ARCANUM_CLI_PROMPT=chat`) that makes the script exit `4` / `FALLBACK=chat`, and how the skill resumes after asking with `AskUserQuestion`. An older skill that doesn't pass the flag gets the no-TTY skip and exit `0`.
- The global, skippable `next/NNN` migration (`applies_to: "global"`) that installs or updates the client with the same rules, and the change to the rule in `docs/agents/architecture/install-and-release.md` ("No per-repo migration installs it").

## Problem

`docs/agents/specs/cli-install/update.md` is still a skeleton. It leaves three open points: the name and location of the client-step script the `git clone` path calls, how `/arcanum-update` resumes after asking the client question in chat, and the migration's `next/NNN` id. It also does not cover the "Already on <v>" no-op paths, a git checkout that predates the feature, a version that cannot be resolved, or the security rules for running `npm i -g` from arcanum. The implementation issues (#868, #870, #871, #872) cannot start until these are settled.

## Expected Behavior

- The part describes the observable behavior: prompts, output lines, exit codes and env vars.
- It lists edge cases and failure modes, each with its outcome.
- It states the testing strategy for its implementation.
- It has an **Alternatives considered** section.
- Any open point that touches another part is resolved in that part or moved to the index's open points.

## Solution

These are the decisions `update.md` must record. They close its three open points.

### Zip updater (`arcanum/update/updater.sh`)

- The client step is the **last step** of `updater.sh`. It runs after the copy, the delete set, the `arcanum.json` write and the `arcanum updated to <v> at <target>` line, and before `cleanup` removes the release tree. A client failure therefore never leaves the arcanum update half-done or blocks a retry.
- It calls the shared script (#868, e.g. `arcanum/_lib/install_cli.sh`) from the **installed** tree (`$TARGET/arcanum/_lib/...`), so the script outlives `cleanup` and the same path works for every caller.
- Target: `arcanum-cli@$VERSION`, the version being installed.
- **Already on the version** (`Already on <v>.`, exit `0`): the client step is **not** run. A no-op update stays a no-op and asks nothing. The global migration (#872) and `arcanum self-update` cover a client that was skipped earlier.
- The update exits `0` whatever the client outcome, except the opt-in exit `4` below.

### `git clone` path (`arcanum/update/bootstrap.sh`)

- After `git checkout <version>` and the `arcanum updated to ...` line, `bootstrap.sh` calls the shared script **from the checked-out tree** (`$TARGET/arcanum/_lib/install_cli.sh`). No extra script is needed: the shared script from #868 is the "client-step script" the index refers to. This closes the open point on its name and location.
- If the checked-out tree has no such script (an `ARCANUM_VERSION` pin older than the feature), the step is skipped silently.
- `Already on <v>.` stays a no-op, as in the zip path.
- The first update after the release runs the old `bootstrap.sh` and gets no client step. The global migration (#872) and the README/release notes (#873) cover it.

### `/arcanum-update` (opt-in `FALLBACK=chat`, and how it resumes)

- `run_update_apply` (both the shell implementation and the native `ArcanumUpdateRunUpdate.js`) sets the opt-in flag `ARCANUM_CLI_PROMPT=chat` next to `ARCANUM_ASSUME_YES=1` when it runs `bootstrap.sh`.
- With the flag and no TTY, the shared script runs its non-interactive checks first (Node/npm, `npm view`, already-installed). Only if an install or update would actually happen does it print `FALLBACK=chat` and `CLI_VERSION=<v>` on stdout and exit `4`. Because the client step is last, the arcanum update is already complete at that point.
- `updater.sh` and the git path of `bootstrap.sh` propagate that exit `4`.
- `bootstrap.sh` runs with inherited stdout, so those two lines reach the skill directly. `run_update_apply`, on exit `4`, still prints the normal `RESULT=updated FROM=<old> TO=<new>` line after them, and exits `4`.
- **Resume:** the skill reports the update as successful, then asks with `AskUserQuestion` (`Install arcanum-cli@<v> with npm i -g?`, options Yes / No / Chat).
  - **Yes:** run a new subcommand, `scripts/run_update.sh install-cli <version>` (the `CLI_VERSION` value). It runs the shared script with the explicit pre-answer `--no-confirm`, so the step skips the prompt and installs, with the same warn-and-continue rules, and exits `0`.
  - **No:** print the manual command (`npm i -g arcanum-cli@<v>`).
  - **Chat:** return to the conversation.
- Any other non-zero exit keeps today's meaning: the arcanum update failed.
- **An old skill**, which sets no flag, gets the no-TTY skip with a warning and exit `0` (index, Backward compatibility).
- With a TTY available (rare inside Claude Code), the shared script just asks on `/dev/tty`, as everywhere else.

### Global migration (`next/001`)

- `arcanum/migrations/repos/next/001.sh` with `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "global"}`. `next/` is empty today, so the id is `001`; this closes the open point. Docs cite `next/001`.
- Target version: the installed arcanum version, from `arcanum.json`'s `.version`, or else `git describe --tags --exact-match` for a git clone. If neither resolves (a clone on a branch or commit), warn and skip with the manual command.
- **Consent:** choosing `[R]un` (or All in the fallback) at the migration prompt is the consent. The migration calls the shared script with the same pre-answer as the `/arcanum-update` resume, so there is no second `[Y/n]`. Users who don't want the client pick `[S]kip`.
- It always exits `0` (warn-and-continue), so the global pointer advances even if the client could not be installed. The warning names the manual command, and the user is not asked again.
- Never downgrade: already-installed handling follows [already-installed.md](already-installed.md).
- In the same PR (#872), `docs/agents/architecture/install-and-release.md` drops "No per-repo migration installs it or nudges the user to" and describes the migration.

### Outcomes (update paths)

| Case | Outcome | Exit |
| --- | --- | --- |
| Update applied, client step installs/updates/skips/warns | As in [install.md](install.md#outcomes) | `0` |
| Already on the version | No client step | `0` |
| `/arcanum-update`, no TTY, flag set, install would happen | `FALLBACK=chat`, `CLI_VERSION=<v>`, then apply's `RESULT=...` | `4` |
| `/arcanum-update`, no TTY, flag set, nothing to do (already current, unpublished, no Node...) | Note or warning, no question | `0` |
| Old skill (no flag), no TTY | No-TTY skip with a warning | `0` |
| Git path, checked-out tree has no client script | Skipped silently | `0` |
| Migration, version unresolvable | Warning with the manual command | `0` |

### Testing strategy

- bats tests for `updater.sh` and the `bootstrap.sh` git path, with stub `node`/`npm` (as in install.md) and a stub shared script that records its call. They assert it is called last, from `$TARGET`, with `$VERSION`; that it is not called on `Already on`; and that exit `4` propagates.
- `run_update_apply`: shell and native spec tests for the flag being set, `FALLBACK=chat`, `CLI_VERSION=` and `RESULT=` on exit `4`, and the new `install-cli` subcommand.
- The migration: bats tests for version resolution (zip, tag, untagged) and the pre-answer.
- `/arcanum-update` skill: the exit `4` branch is reviewed by `skill-reviewer` (TTY-first with `AskUserQuestion` fallback).

### Names (closes the index's open point on env var names)

| Name | Kind | Meaning |
| --- | --- | --- |
| `ARCANUM_SKIP_CLI` | env var | Any non-empty value skips the client step without asking or calling `npm`. Same convention as `ARCANUM_ASSUME_YES`; docs show `ARCANUM_SKIP_CLI=1`. |
| `ARCANUM_CLI_PROMPT=chat` | env var | Opt-in: with no TTY, exit `4` / `FALLBACK=chat` instead of the no-TTY skip. Any other value, or unset, keeps the no-TTY skip. Only `run_update_apply` sets it. It must be an env var, because it has to cross `bootstrap.sh` → `exec updater.sh`. It only asks; it never consents. |
| `--no-confirm` | argument of the shared script | Pre-answers yes and skips the `[Y/n]` prompt. Used only by `run_update.sh install-cli` and the migration. Same name and meaning as `update_per_file.sh --no-confirm`. |
| `FALLBACK=chat`, `CLI_VERSION=<v>` | stdout keys, exit `4` | What the skill reads to ask the question and resume. |
| `run_update.sh install-cli <version>` | skill subcommand | Resumes only the client step after the chat answer. A verb, like `check` and `apply`. |

The wording of the prompt and the warnings stays an open point in the index, for #868.

### Performance & security

Security:

- **Validated version.** `VERSION` comes from `ARCANUM_VERSION` or a GitHub `tag_name`, and on `/arcanum-update` it travels through `CLI_VERSION=` and back as the `install-cli <version>` argument. The shared script (#868) validates it as a plain semver (`MAJOR.MINOR.PATCH[-prerelease]`) before any `npm` call. Anything else is a warning plus a skip, never an `npm` call. It always passes `arcanum-cli@<v>` as one quoted argument.
- **Exact pin.** It always installs an exact version, never a range or a dist-tag, so the version installed is the version named in the prompt.
- **`--ignore-scripts`.** It runs `npm i -g --ignore-scripts arcanum-cli@<v>`. `arcanum-cli` has no dependencies and no install-time scripts, so nothing is lost, and a compromised publish cannot run code at install time. (The CircleCI publish has no npm provenance, so this is the cheapest guard available.)
- **Consent cannot leak through the environment.** The pre-answer used by the `/arcanum-update` resume and the migration is a command-line argument (`--no-confirm`), never an env var, so an exported variable cannot silently consent to a machine-wide install. `ARCANUM_SKIP_CLI` can only *skip*.
- **No `sudo`, ever** (index, Warn and continue). On `EACCES` the warning points to fixing the npm prefix.
- **Forks.** The package name is always `arcanum-cli` on the user's configured npm registry, whatever `ARCANUM_REPO` is. A fork whose tag matches an official version gets the official client of that version. The fork case is documented in the spec, not special-cased.
- The user's npm config (registry, proxy, prefix) is honored as is. The step passes no registry override.

Performance:

- Skipped paths (`ARCANUM_SKIP_CLI`, a no-TTY run without the flag, `Already on <v>`, a missing script in the git tree) make no `npm` call.
- Otherwise the cost is one `npm view` (and the installed-version check from already-installed.md) before asking, plus `npm i -g` only after consent.
- `npm view` runs with a bounded fetch (`--fetch-retries=0 --fetch-timeout=<~15s>`), so an offline machine warns quickly instead of stalling the update. A timeout falls into the "network error, warn and skip" outcome. `npm i -g` keeps npm's defaults: the user has consented and is waiting for it.

### Alternatives considered (to add to update.md)

- **A separate client-step script for the git path.** Rejected: the shared script from #868 already is that script; a second one would duplicate the rules.
- **Running the client step on `Already on <v>`.** Rejected: every no-op update would ask again, including users who declined; the migration and `self-update` cover the gap.
- **The skill re-running the whole update after the chat answer.** Rejected: the arcanum update has already finished; re-running it is a no-op that would skip the client step anyway. A dedicated `install-cli` subcommand resumes just the client step.
- **Letting npm run install scripts.** Rejected: the package needs none, and `--ignore-scripts` removes code execution at install time.
- **`--yes` as the pre-answer name.** Rejected in favor of `--no-confirm`, which arcanum already uses for the same meaning in the migration runner.
- **`ARCANUM_CLI_FALLBACK=chat` for the opt-in.** Rejected: `ARCANUM_CLI_PROMPT` is already the documented name, and it describes what the flag changes (how the prompt is asked), not the mechanism.
- **An env var as the pre-answer.** Rejected: an exported variable could consent to a machine-wide install without the user seeing a prompt.
- **A second `[Y/n]` inside the migration.** Rejected: `[R]un` is already explicit consent, and a second prompt would break the migration's no-TTY fallback mode.

### Index and install.md sync

Besides `update.md`, this issue also edits:

- the index: move the Performance & security rules (semver validation, `--ignore-scripts`, CLI-argument-only consent, bounded `npm view`) into **Shared rules**, since every caller of the shared script follows them; replace the `ARCANUM_CLI_PROMPT=chat` placeholder wording; and drop the env var names from **Open points**, leaving only the prompt and warning wording;
- `install.md`: step 5.7 becomes `npm i -g --ignore-scripts arcanum-cli@<version>`, and the outcome table gains an "invalid version" row (warning, no `npm` call, exit `0`).

### Migration

Yes, `next/001` above (#872).

### Owner

`architect` (docs only).

## Benefits

- #868, #870, #871 and #872 can be implemented from the spec alone, without reopening #861.
- One shared script with one set of rules (consent, version validation, `--ignore-scripts`, bounded `npm view`) serves the installer, both update paths and the migration.
- `/arcanum-update` never reports a finished arcanum update as failed, whatever the skill version, and it can still offer the client install inside Claude Code.
