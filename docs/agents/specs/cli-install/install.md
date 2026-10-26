# CLI Install: Install

Part of the [CLI Install](../cli-install.md) spec. The shared rules (prompt, `ARCANUM_SKIP_CLI`, opt-in `FALLBACK=chat`, no-TTY skip, warn-and-continue) and version pinning live in the index and apply here unchanged.

## Purpose

Make the `curl | bash` installer (`arcanum/install/`) install `arcanum-cli@<version>` as part of installing arcanum.

## Decisions

- **Placement.** The client step is the last step of `arcanum/install/installer.sh`. It runs after the target-directory prompt, after the copy and the `arcanum.json` write, and after the `arcanum installed to <target>` line. A client failure therefore never leaves arcanum half-installed.
- **Shared script.** The installer calls the shared client-step script (#868). It does not implement the prompt, the checks or the `npm` calls itself. The same script serves [update.md](update.md).
- **Two separate confirmations.** The arcanum `[y/N]` trust prompt stays in `arcanum/install/bootstrap.sh`, and `ARCANUM_ASSUME_YES` skips it. The client `[Y/n]` prompt is asked from `installer.sh` through the shared script, and `ARCANUM_ASSUME_YES` does not answer it.
- **Target.** `arcanum-cli@$VERSION`, using the `VERSION` that `bootstrap.sh` exports (`ARCANUM_VERSION`, or its default). See [Version pinning](../cli-install.md#version-pinning).
- **Unpublished version.** Before installing, the step runs `npm view arcanum-cli@<version> version`:
  - an `E404` error, or empty output, means the version is not published: warn and skip;
  - any other `npm view` failure is treated as a network error: warn and skip.
- **Exit code.** The install exits `0` whatever the client outcome: installed, skipped, declined, or failed with a warning.
- **Already installed.** `installer.sh` already refuses an existing arcanum install, so the only double install it can meet is a client that is already installed globally. That case follows [already-installed.md](already-installed.md) and is not repeated here.
- **Git clone.** Running `installer.sh` directly from a git clone still needs `REPO` and `VERSION` set in the environment, as today. The client step adds no new requirement.

## Flow

1. `bootstrap.sh` asks the arcanum `[y/N]` trust prompt, unless `ARCANUM_ASSUME_YES` is set. It then downloads the release zip and execs `installer.sh`.
2. `installer.sh` asks for the target directory, and confirms it when it is not the default.
3. `installer.sh` refuses an existing arcanum install, then copies the tree and writes `arcanum.json`.
4. `installer.sh` prints `arcanum installed to <target>`.
5. `installer.sh` runs the client step through the shared script. It is the last step:
   1. If `ARCANUM_SKIP_CLI` is set, skip without asking and without calling `node` or `npm`.
   2. If there is no TTY, no `--no-confirm` and no `ARCANUM_CLI_PROMPT=chat`, skip with a warning, without calling `npm`. With `--no-confirm` the script never opens `/dev/tty`.
   3. Check `node` and `npm`: both must be on `PATH`, and Node must be at least 22.13.0.
   4. Detect an installed client with `npm ls` (local). If one is installed, follow [already-installed.md](already-installed.md#flow): an unchanged, newer, linked or unreadable client ends the step here, and an older one continues as an update.
   5. Check that `arcanum-cli@$VERSION` is published, with `npm view`.
   6. Ask the `[Y/n]` prompt from `/dev/tty`: `Install arcanum-cli@<version> globally (npm i -g)? [Y/n]`. Enter means yes. For an older client, the prompt is worded as an update naming both versions: `Update arcanum-cli <old> → <version> (npm i -g)? [Y/n]`.
   7. Run `npm i -g --ignore-scripts arcanum-cli@<version>`.
   8. Check that `arcanum` on `PATH` is the client just installed, and warn otherwise (see [already-installed.md](already-installed.md#foreign-arcanum-on-path)).

Steps 1 to 4 keep their current behavior and exit codes. In particular, aborting the target confirmation or hitting an existing arcanum install still exits `1`, before the client step runs.

In this installer, step 5.2 is rarely reached: the target-directory prompt already reads `/dev/tty`, so a run with no TTY fails there first. The shared script still handles it, because the update paths can reach it.

Checks that need no user input run first, so the prompt is only asked when the install can actually happen. Detection (5.4) before `npm view` (5.5) is fixed by [already-installed.md](already-installed.md#flow), so an up-to-date client costs no network call. The full order, including the version validation, is in [already-installed.md's Flow](already-installed.md#flow); #868 may otherwise reorder checks, as long as every outcome below holds.

## Outcomes

Every outcome exits `0`. Each outcome prints one line on stderr, prefixed `arcanum-cli:`: info lines are `arcanum-cli: <message>`, warnings are `arcanum-cli: warning: <reason>. Install it manually with: npm i -g arcanum-cli@<version>`. stdout stays empty. The only other exits are `1` for a usage error (missing or extra arguments) and the opt-in exit `4` of [update.md](update.md#arcanum-update-opt-in-fallbackchat).

| Case | Condition | Output | Exit |
| --- | --- | --- | --- |
| Installed | The user accepts (`Install arcanum-cli@<version> globally (npm i -g)? [Y/n]`) and `npm i -g` succeeds. | `arcanum-cli: arcanum-cli@<version> installed.` | `0` |
| Skipped by env | `ARCANUM_SKIP_CLI` is set (any non-empty value). | `arcanum-cli: client step skipped (ARCANUM_SKIP_CLI is set)` | `0` |
| Invalid version | `VERSION` is not a plain semver. | `arcanum-cli: warning: '<version>' is not a plain semver version, client step skipped. Install it manually with: npm i -g arcanum-cli`. No `npm` call. | `0` |
| Skipped, no TTY | No `/dev/tty`, no `--no-confirm` and no `ARCANUM_CLI_PROMPT=chat`. | `arcanum-cli: warning: no TTY to ask for consent, client step skipped. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| Declined | The user answers no (or the TTY closes before an answer). | `arcanum-cli: skipped by user. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| No Node or npm | `node` or `npm` is not on `PATH`. | `arcanum-cli: warning: node or npm is not on PATH, client step skipped. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| Node too old | Node is below 22.13.0. | `arcanum-cli: warning: Node <found> found, 22.13.0 or later required, client step skipped. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| Unpublished version | `npm view` reports `E404`, or prints nothing. | `arcanum-cli: warning: arcanum-cli@<version> is not published on npm, client step skipped. Install it manually with: npm i -g arcanum-cli` | `0` |
| EACCES | `npm i -g` fails with `EACCES`. | `arcanum-cli: warning: npm i -g failed with EACCES (no write access to the npm global prefix); fix the prefix (npm config set prefix) or run the command with the right permissions. Install it manually with: npm i -g arcanum-cli@<version>`. No `sudo` retry. | `0` |
| EEXIST | `npm i -g` fails with `EEXIST`. | `arcanum-cli: warning: npm i -g failed with EEXIST (another package owns the arcanum binary). Install it manually with: npm i -g arcanum-cli@<version>`. No `--force`. | `0` |
| Network error | `npm view` fails for any reason other than `E404`, or `npm i -g` fails for any other reason. | `npm view`: `arcanum-cli: warning: could not reach the npm registry (network error[: <code>]), client step skipped. Install it manually with: npm i -g arcanum-cli@<version>`. `npm i -g`: `arcanum-cli: warning: npm i -g failed (<code or exit status>). Install it manually with: npm i -g arcanum-cli@<version>`. | `0` |
| Client already installed | `arcanum-cli` is already installed globally. | Updated, unchanged, newer kept, linked or unknown: see [already-installed.md's Outcomes](already-installed.md#outcomes). | `0` |

## Testing strategy

For #869 and #868:

- Standalone shell tests (`arcanum/_lib/test_install_cli.sh`, in the style of `arcanum/_lib/test_lock.sh`; running them in CI is #882), with stub `node` and `npm` executables placed first on `PATH`. The stubs record their calls and return canned output and exit codes.
- One test per row of the [Outcomes](#outcomes) table. Each asserts the output line and exit `0`.
- A test that `ARCANUM_SKIP_CLI=1` and the no-TTY case never call `npm`.
- A test that `ARCANUM_ASSUME_YES` does not answer the client prompt.
- A test that the client step runs after `arcanum.json` is written, so a client failure leaves a complete arcanum install.
- The installer has no tests today. The prompt is driven through a test-only TTY device override, following the `ARCANUM_TTY_DEVICE` seam that `arcanum/_lib/next_step_prompt_shell.sh` already uses.

## Alternatives considered

- **Updating an existing arcanum install** instead of refusing. Rejected and out of scope: the installer keeps refusing when the target directory already has an arcanum install, and points to `update`.
- **Running the client step before the copy.** Rejected: a client failure or a slow `npm` could abort a half-done install.
- **Prompting for the client inside `bootstrap.sh`.** Rejected: the bootstrap is piped straight into bash and must stay minimal. It only resolves a version and hands off to the installer.
- **Treating every `npm view` failure as "not published".** Rejected: it would hide network errors behind a misleading message.
- **Skipping the `npm view` check and relying on `npm i -g` failing.** Rejected: the `npm i -g` error for a missing version is hard to tell apart from other failures, so the warning could not name the real reason.

## Open points

None left in this part. The shared open point (the exact prompt and warning wording) stay in the index's [Open points](../cli-install.md#open-points).
