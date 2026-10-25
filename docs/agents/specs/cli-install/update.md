# CLI Install: Update

Part of the [CLI Install](../cli-install.md) spec. The shared rules (prompt, `ARCANUM_SKIP_CLI`, opt-in `FALLBACK=chat`, no-TTY skip, warn-and-continue, version validation, `--ignore-scripts`, consent by argument only, bounded `npm view`) and version pinning live in the index and apply here unchanged.

## Purpose

Make every update path install or update `arcanum-cli@<version>`: the updater (`arcanum/update/`) from its local and `curl | bash` entry points, the `/arcanum-update` skill, and `git clone` installs. Also covers the global migration for installs that update before the client step reaches them.

## Decisions

### Zip updater (`arcanum/update/updater.sh`)

- **Placement.** The client step is the last step of `updater.sh`. It runs after the copy, the delete set, the `arcanum.json` write and the `arcanum updated to <v> at <target>` line, and before `cleanup` removes the release tree. A client failure therefore never leaves the arcanum update half-done or blocks a retry.
- **Shared script.** It calls the shared client-step script (#868, for example `arcanum/_lib/install_cli.sh`) from the **installed** tree (`$TARGET/arcanum/_lib/...`), so the script outlives `cleanup` and the same path works for every caller. The old local `bootstrap.sh` execs the *new* `updater.sh`, so this works from the first update after the release.
- **Target.** `arcanum-cli@$VERSION`, the version being installed. See [Version pinning](../cli-install.md#version-pinning).
- **Already on the version.** On `Already on <v>.` (exit `0`), the client step is **not** run. A no-op update stays a no-op and asks nothing. The [global migration](#global-migration-next001) and `arcanum self-update` cover a client that was skipped earlier.

### `git clone` path (`arcanum/update/bootstrap.sh`)

- **Placement.** After `git checkout <version>` and the `arcanum updated to ...` line, `bootstrap.sh` calls the shared client-step script **from the checked-out tree** (`$TARGET/arcanum/_lib/...`), so every later update runs the new copy.
- **No extra script.** The shared script from #868 is the client-step script the index refers to. The git path needs no script of its own.
- **Old checkout.** If the checked-out tree has no such script (an `ARCANUM_VERSION` pin older than the feature), the step is skipped silently.
- **Already on the version.** `Already on <v>.` stays a no-op, as in the zip path.
- **First update after the release.** It still runs the old `bootstrap.sh`, which has no client step. The [global migration](#global-migration-next001) and the README and release notes (#873) point those users to `npm i -g arcanum-cli` once.

### `/arcanum-update` (opt-in `FALLBACK=chat`)

- **Opt-in.** `run_update_apply` sets `ARCANUM_CLI_PROMPT=chat` next to `ARCANUM_ASSUME_YES=1` when it runs `bootstrap.sh`. This applies to both its shell implementation and the native `ArcanumUpdateRunUpdate.js`.
- **Exit `4`.** With the flag and no TTY, the shared script runs its non-interactive checks first (Node and npm, `npm view`, already installed). Only if an install or update would actually happen does it print `FALLBACK=chat` and `CLI_VERSION=<v>` on stdout and exit `4`. Because the client step is last, the arcanum update is already complete at that point.
- **Propagation.** `updater.sh` and the git path of `bootstrap.sh` propagate that exit `4`. `bootstrap.sh` runs with inherited stdout, so both lines reach the skill directly. On exit `4`, `run_update_apply` still prints its normal `RESULT=updated FROM=<old> TO=<new>` line after them, and exits `4`.
- **Resume.** The skill reports the update as successful, then asks with `AskUserQuestion`: `Install arcanum-cli@<v> with npm i -g?`, with options Yes, No and Chat.
  - **Yes:** run a new subcommand, `scripts/run_update.sh install-cli <version>`, with the `CLI_VERSION` value. It runs the shared script with the pre-answer `--no-confirm`, so the step skips the prompt and installs, under the same warn-and-continue rules, and exits `0`.
  - **No:** print the manual command (`npm i -g arcanum-cli@<v>`).
  - **Chat:** return to the conversation.
- **Other exits.** Any other non-zero exit keeps today's meaning: the arcanum update failed.
- **Old skill.** An older skill, which sets no flag, gets the no-TTY skip with a warning and exit `0` (see [Backward compatibility](../cli-install.md#backward-compatibility)).
- **TTY.** When a TTY is available (rare inside Claude Code), the shared script asks on `/dev/tty`, as everywhere else.

### Global migration (`next/001`)

- **Entry.** A new `next/001` migration (`001.sh` in the `next/` folder of `arcanum/migrations/repos/`), with the manifest entry `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "global"}`. `next/` is empty today, so the id is `001`. If another migration lands in `next/` first, #872 takes the next free id and updates this spec.
- **Citation.** This spec cites the migration as `next/001`, without the `repos/` prefix, on purpose: `scripts/bump-version.sh` aborts on any `repos/next/NNN` reference whose file does not exist yet (see [Per-Repo Migrations](../../architecture/per-repo-migrations.md)). #872, which creates the file, switches docs to the full file path, as the doc convention there requires.
- **Target version.** The installed arcanum version: `arcanum.json`'s `.version`, or else `git describe --tags --exact-match` for a git clone. If neither resolves (a clone on a branch or an untagged commit), the migration warns and skips, naming the manual command.
- **Consent.** Choosing `[R]un` (or All in the fallback) at the migration prompt is the consent. The migration calls the shared script with `--no-confirm`, the same pre-answer as the `/arcanum-update` resume, so there is no second `[Y/n]`. Users who don't want the client pick `[S]kip`.
- **Exit code.** It always exits `0` (warn-and-continue), so the global pointer advances even if the client could not be installed. The warning names the manual command, and the user is not asked again.
- **Never downgrade.** Already-installed handling follows [already-installed.md](already-installed.md).
- **Rule change.** In the same PR (#872), [Install & Release Pipeline](../../architecture/install-and-release.md) drops "No per-repo migration installs it or nudges the user to" and describes the migration.

### Exit code

The update exits `0` whatever the client outcome, except the opt-in exit `4` of `/arcanum-update`.

## Flow

### Zip updater

1. `bootstrap.sh` resolves the version, downloads the release zip and execs `updater.sh`.
2. `updater.sh` exits `0` with `Already on <v>.` if the install is already on the version. No client step runs.
3. `updater.sh` copies the tree, applies the delete set, writes `arcanum.json` and prints `arcanum updated to <v> at <target>`.
4. `updater.sh` runs `$TARGET/arcanum/_lib/<shared script>` for `arcanum-cli@$VERSION`, following [install.md's Flow](install.md#flow) step 5. It propagates an exit `4`, and otherwise ignores the client's exit.
5. `cleanup` removes the release tree, and `updater.sh` exits `0` (or `4`).

### `git clone` path

1. `bootstrap.sh` detects the git clone and runs `git fetch`.
2. It exits `0` with `Already on <v>.` if the checkout is already on the version. No client step runs.
3. It runs `git checkout <version>` and prints `arcanum updated to ...`.
4. If `$TARGET/arcanum/_lib/<shared script>` exists in the checked-out tree, it runs it for `arcanum-cli@$VERSION`, and propagates an exit `4`. Otherwise it skips silently.
5. It exits `0` (or `4`).

### `/arcanum-update`

1. `run_update_apply` runs `bootstrap.sh` with `ARCANUM_ASSUME_YES=1` and `ARCANUM_CLI_PROMPT=chat`.
2. The zip or git flow above runs. With no TTY, the shared script runs its checks and, only if an install or update would happen, prints `FALLBACK=chat` and `CLI_VERSION=<v>` and exits `4`.
3. `run_update_apply` prints `RESULT=updated FROM=<old> TO=<new>` and exits with the same code (`0` or `4`).
4. On exit `4`, the skill reports the successful update and asks Yes / No / Chat with `AskUserQuestion`.
5. On Yes, it runs `scripts/run_update.sh install-cli <CLI_VERSION>`, which runs the shared script with `--no-confirm` and exits `0`. On No, it prints `npm i -g arcanum-cli@<v>`.

### Global migration

1. `/arcanum-migrate` offers `next/001` once per machine or account, as a skippable global migration.
2. On `[S]kip`, nothing runs and the pointer advances.
3. On `[R]un`, the migration resolves the target version from `arcanum.json`'s `.version`, or else from `git describe --tags --exact-match`. If neither resolves, it warns with the manual command and exits `0`.
4. It runs the shared script for `arcanum-cli@<version>` with `--no-confirm`, and exits `0` whatever the client outcome.

## Outcomes

| Case | Outcome | Exit |
| --- | --- | --- |
| Update applied, client step installs, updates, skips or warns | As in [install.md's Outcomes](install.md#outcomes) | `0` |
| Already on the version | No client step | `0` |
| `/arcanum-update`, no TTY, flag set, install would happen | `FALLBACK=chat`, `CLI_VERSION=<v>`, then `RESULT=...` from `run_update_apply` | `4` |
| `/arcanum-update`, no TTY, flag set, nothing to do (already current, unpublished, no Node...) | Note or warning, no question | `0` |
| `/arcanum-update` resume, Yes | `install-cli` runs the client step with `--no-confirm`, per [install.md's Outcomes](install.md#outcomes) | `0` |
| Old skill (no flag), no TTY | No-TTY skip with a warning | `0` |
| Git path, checked-out tree has no client-step script | Skipped silently | `0` |
| Migration skipped | Nothing runs; the pointer advances | `0` |
| Migration, version unresolvable | Warning with the manual command | `0` |
| Migration run, client step installs, updates or warns | As in [install.md's Outcomes](install.md#outcomes); never a downgrade | `0` |

## Names

| Name | Kind | Meaning |
| --- | --- | --- |
| `ARCANUM_SKIP_CLI` | env var | Any non-empty value skips the client step without asking or calling `npm`. Same convention as `ARCANUM_ASSUME_YES`; docs show `ARCANUM_SKIP_CLI=1`. |
| `ARCANUM_CLI_PROMPT=chat` | env var | Opt-in: with no TTY, exit `4` / `FALLBACK=chat` instead of the no-TTY skip. Any other value, or unset, keeps the no-TTY skip. Only `run_update_apply` sets it. It must be an env var, because it has to cross `bootstrap.sh` → `exec updater.sh`. It only asks; it never consents. |
| `--no-confirm` | argument of the shared script | Pre-answers yes and skips the `[Y/n]` prompt. Used only by `run_update.sh install-cli` and the migration. Same name and meaning as `update_per_file.sh --no-confirm`. |
| `FALLBACK=chat`, `CLI_VERSION=<v>` | stdout keys, exit `4` | What the skill reads to ask the question and resume. |
| `run_update.sh install-cli <version>` | skill subcommand | Resumes only the client step after the chat answer. A verb, like `check` and `apply`. |

## Testing strategy

For #870, #871 and #872:

- bats tests for `updater.sh` and the `bootstrap.sh` git path, with stub `node` and `npm` executables (as in [install.md's Testing strategy](install.md#testing-strategy)) and a stub shared script that records its calls. They assert that it is called last, from `$TARGET`, with `$VERSION`; that it is not called on `Already on <v>.`; that the git path skips silently when the script is missing; and that exit `4` propagates.
- `run_update_apply`: shell and native spec tests that the flag is set, that `FALLBACK=chat`, `CLI_VERSION=` and `RESULT=` are printed on exit `4`, and for the new `install-cli` subcommand.
- The migration: bats tests for version resolution (zip, tag, untagged) and for the `--no-confirm` pre-answer.
- `/arcanum-update` skill: the exit `4` branch is reviewed by `skill-reviewer` (TTY-first with an `AskUserQuestion` fallback).

## Alternatives considered

- **Accepting a one-update lag for `git clone` installs**, with no migration and no documented step. Rejected: those users would silently miss the client on the first update.
- **A repo-scoped migration.** Rejected: the client is installed machine-wide, so it runs once per machine or account, not once per repo.
- **A nudge-only migration** that only tells the user to run `npm i -g arcanum-cli`. Rejected in favor of a migration that installs the client, skippable for users who do not want it.
- **A separate client-step script for the git path.** Rejected: the shared script from #868 already is that script; a second one would duplicate the rules.
- **Running the client step on `Already on <v>`.** Rejected: every no-op update would ask again, including users who declined. The migration and `self-update` cover the gap.
- **The skill re-running the whole update after the chat answer.** Rejected: the arcanum update has already finished, so re-running it is a no-op that would skip the client step anyway. A dedicated `install-cli` subcommand resumes just the client step.
- **A second `[Y/n]` inside the migration.** Rejected: `[R]un` is already explicit consent, and a second prompt would break the migration's no-TTY fallback mode.
- **Letting npm run install scripts.** Rejected: the package needs none, and `--ignore-scripts` removes code execution at install time.
- **`--yes` as the pre-answer name.** Rejected in favor of `--no-confirm`, which arcanum already uses with the same meaning in the migration runner.
- **`ARCANUM_CLI_FALLBACK=chat` for the opt-in.** Rejected: `ARCANUM_CLI_PROMPT` is already the documented name, and it describes what the flag changes (how the prompt is asked), not the mechanism.
- **An env var as the pre-answer.** Rejected: an exported variable could consent to a machine-wide install without the user seeing a prompt.

## Open points

None left in this part. The shared open point (the exact prompt and warning wording) stays in the index's [Open points](../cli-install.md#open-points).
