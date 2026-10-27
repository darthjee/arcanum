# Issue: Handle the CLI install prompt in /arcanum-update

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum). Depends on #870 (merged): `updater.sh` and the git path of `bootstrap.sh` already run `arcanum/_lib/install_cli.sh` as their last step and propagate its exit `4`.

Make `/arcanum-update` opt in to the chat fallback of the client step and handle it. `run_update_apply` sets `ARCANUM_CLI_PROMPT=chat`. On exit `4` the skill reports the arcanum update as successful, asks the install question with `AskUserQuestion`, and resumes only the client step with a new `run_update.sh install-cli <version>` subcommand.

Source of truth: `docs/agents/specs/cli-install/update.md` (`/arcanum-update` section) and `already-installed.md`. If the spec turns out to be wrong during implementation, update it in the same PR.

## Problem

- `/arcanum-update` runs inside Claude Code, where there is no TTY. Without the opt-in, `install_cli.sh` takes the no-TTY skip, so the client is never installed or updated by the skill.
- Today any non-zero exit from `run_update.sh apply` means the arcanum update failed. Exit `4` must not be reported that way, because the arcanum update is already complete when the client step runs.
- The zip updater copies the new release over the install with `cp -R`, which rewrites each file in place (same inode). `run_update.sh` (and `run_update_apply_shell.sh` in shell mode) are still running while they are overwritten. Bash reads the rest of a running script from the file at its old byte offset, so when the new copy differs, the rest of the run reads the new file from the wrong place. Reproduced: a script whose case statement gains a branch while it runs dies with `unexpected EOF` and exit `2` after the copy succeeded. Adding `install-cli` to `run_update.sh` triggers exactly this on the first zip update into this release, so the skill would report a failed update.

## Expected Behavior

- `run_update_apply` (shell `run_update_apply_shell.sh` and native `ArcanumUpdateRunUpdate.apply`) runs `bootstrap.sh` with `ARCANUM_ASSUME_YES=1` and `ARCANUM_CLI_PROMPT=chat`.
- When `bootstrap.sh` exits `4`, `run_update_apply` still prints its `RESULT=updated FROM=<old> TO=<new>` line, after the `FALLBACK=chat`, `CLI_VERSION=<v>` and optional `CLI_INSTALLED=<v>` lines from the client step, and exits `4`. Exit `0` and every other non-zero exit behave as today.
- `scripts/run_update.sh install-cli <version>` runs the shared script with `--no-confirm` and exits with its code (`0` for every outcome, `1` for a usage error, such as a missing version).
- `/arcanum-update` on exit `4`: it reports the version change and the new-session reminder, then asks once with `AskUserQuestion`: `Install arcanum-cli@<v> with npm i -g?`, or, with `CLI_INSTALLED`, an update question naming both versions. The options are Yes, No and Chat.
  - Yes: run `run_update.sh install-cli <CLI_VERSION>` and relay its output.
  - No: print `npm i -g arcanum-cli@<v>`.
  - Chat, or a free-text answer: return to the conversation.
  - A dismissed question counts as No. With `AskUserQuestion` unavailable, print the manual command.
- The zip update never rewrites a running script in place: a file that changes is replaced with a new file (new inode), so scripts that are still running keep reading their old copy. The first update into this release works from any older install, in shell, native and docker modes.

## Solution

### Scope

1. **`run_update_apply`** (owners `scripter` and `node`):
   - `arcanum-update/scripts/run_update_apply_shell.sh`: export `ARCANUM_CLI_PROMPT=chat` next to `ARCANUM_ASSUME_YES=1`. On `RC=4`, compute `AFTER`, print the `RESULT=` line, `exit 4`.
   - `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js`: add `ARCANUM_CLI_PROMPT: 'chat'` to the spawn env. On code `4`, throw `new DispatchFailure('RESULT=...\n', 4)`, so `core/bin/arcanum` prints it and exits `4`.
   - Update the header comments of `run_update.sh`, `run_update_apply_shell.sh` and the JSDoc.
2. **`install-cli` subcommand** (owner `scripter`): a new `install-cli)` branch in `arcanum-update/scripts/run_update.sh` that runs `"${TARGET_PATH}/arcanum/_lib/install_cli.sh" "$2" --no-confirm` directly. It is not a migrated entrypoint: no `engine_dispatch`, no `_shell.sh` twin, no native command, no `migration-status.json` entry. `install_cli.sh` is plain bash by design and must use the host's `npm`, and `install-cli` only wraps it. Missing or extra arguments: usage on stderr, exit `1`; version validation is left to `install_cli.sh`.
3. **Updater copy** (owner `scripter`): in `arcanum/update/updater.sh`, replace changed files with new inodes instead of overwriting them in place. For example, remove each target file that the release tree also has before `cp -R`, or copy to a temporary name and `mv`. The old `bootstrap.sh` execs the **new** `updater.sh`, so this protects the first update into this release, from any older install.
4. **Skill** (owner `skill-writer`): `arcanum-update/SKILL.md` Step 3 gets an exit `4` branch, as described in Expected Behavior. It reads `CLI_VERSION` and `CLI_INSTALLED` from the streamed stdout. The `Nonzero exit` branch becomes `any other nonzero exit`. The TTY side is already handled by `install_cli.sh`, which asks on `/dev/tty` when one exists. `skill-reviewer` checks the new branch.
5. **Docs**:
   - `docs/agents/specs/cli-install.md`: Status line (#871 done).
   - `update.md`: `install-cli` is a plain subcommand, not a migrated entrypoint; the updater-copy decision; testing names.
   - `core/lib/commands/arcanum-update/README.md` and the install/release architecture doc, where they describe the copy.

### Testing strategy

- Native: `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js` asserts that the spawn env has `ARCANUM_CLI_PROMPT=chat` and `ARCANUM_ASSUME_YES=1`, and that exit `4` gives a `DispatchFailure` with the `RESULT=` payload and code `4`.
- Parity: `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js` and the `arcanum_update_bootstrap_stub.sh` fixture gain an exit-`4` case, in which the stub bumps the version, prints `FALLBACK=chat` and `CLI_VERSION=`, and records the `ARCANUM_CLI_PROMPT` it saw. Both engines must print the same stdout and exit `4`.
- `install-cli`: a standalone test script, `arcanum-update/scripts/test_run_update_install_cli.sh`, in the `test_*.sh` style. It stubs `install_cli.sh` and asserts that it is called with `<version> --no-confirm`, that its exit code passes through, and that missing arguments give a usage error and exit `1`.
- Updater copy: a new case in `arcanum/update/test_updater.sh`. A script in the install that is running while the update replaces it with a longer version still finishes cleanly with exit `0`, and the target file has the new content.

### Backward compatibility

- An old skill that sets no flag still gets the no-TTY skip and exit `0`.
- An old `SKILL.md` already loaded in the session, together with the new `run_update.sh` on disk, cannot see exit `4` on the crossing update, because the running `run_update_apply` is still the old code and sets no flag.

## Benefits

- `/arcanum-update` installs or updates `arcanum-cli` with an explicit yes, with no shell needed.
- The arcanum update is never reported as failed because of the client step.
- Updates stop corrupting running scripts, which protects this change and every future change to `run_update.sh`.
