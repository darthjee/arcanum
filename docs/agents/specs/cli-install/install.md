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
   2. If there is no TTY (and no opt-in `FALLBACK=chat` flag), skip with a warning, without calling `npm`.
   3. Check `node` and `npm`: both must be on `PATH`, and Node must be at least 22.13.0.
   4. Check that `arcanum-cli@$VERSION` is published, with `npm view`.
   5. If the client is already installed, follow [already-installed.md](already-installed.md).
   6. Ask the `[Y/n]` prompt from `/dev/tty`, naming `arcanum-cli@<version>` and `npm i -g`. Enter means yes.
   7. Run `npm i -g --ignore-scripts arcanum-cli@<version>`.

Steps 1 to 4 keep their current behavior and exit codes. In particular, aborting the target confirmation or hitting an existing arcanum install still exits `1`, before the client step runs.

In this installer, step 5.2 is rarely reached: the target-directory prompt already reads `/dev/tty`, so a run with no TTY fails there first. The shared script still handles it, because the update paths can reach it.

The order of 5.3 to 5.6 is a proposal: checks that need no user input run first, so the prompt is only asked when the install can actually happen. #868 may reorder them, as long as every outcome below holds.

## Outcomes

Every outcome exits `0`. Each skip or failure prints one line on stderr, naming the reason and, for warnings, the manual command (`npm i -g arcanum-cli@<version>`).

| Case | Condition | Output | Exit |
| --- | --- | --- | --- |
| Installed | The user accepts and `npm i -g` succeeds. | Info: `arcanum-cli@<version>` installed. | `0` |
| Skipped by env | `ARCANUM_SKIP_CLI` is set (any non-empty value). | Info: client step skipped. | `0` |
| Invalid version | `VERSION` is not a plain semver. | Warning, with the manual command. No `npm` call. | `0` |
| Skipped, no TTY | No `/dev/tty` and no opt-in flag. | Warning, with the manual command. | `0` |
| Declined | The user answers no. | Info, with the manual command. | `0` |
| No Node or npm | `node` or `npm` is not on `PATH`. | Warning, with the manual command. | `0` |
| Node too old | Node is below 22.13.0. | Warning naming the found and required versions, with the manual command. | `0` |
| Unpublished version | `npm view` reports `E404`, or prints nothing. | Warning that `arcanum-cli@<version>` is not on npm, with the manual command (`npm i -g arcanum-cli`). | `0` |
| EACCES | `npm i -g` fails with `EACCES`. | Warning with a hint to fix the npm global prefix or run the manual command with the right permissions. No `sudo` retry. | `0` |
| Network error | `npm view` or `npm i -g` fails for any other reason. | Warning with the reason and the manual command. | `0` |
| Client already installed | `arcanum-cli` is already installed globally. | See [already-installed.md](already-installed.md). | `0` |

## Testing strategy

For #869 and #868:

- bats tests, with stub `node` and `npm` executables placed first on `PATH`. The stubs record their calls and return canned output and exit codes.
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
