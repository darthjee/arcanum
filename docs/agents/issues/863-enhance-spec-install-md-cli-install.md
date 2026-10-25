# Issue: Enhance spec: install.md (CLI install)

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Enhance `docs/agents/specs/cli-install/install.md` from the skeleton merged in #862 into a complete design that #869 (the implementation) can follow without reopening #861. Docs only: no script or code changes.

## Problem

The skeleton records the decisions but leaves two open points:
- Where the client step runs relative to the target-directory prompt.
- How an unpublished `arcanum-cli` version is detected.

It also lacks the observable behavior, the failure modes and a testing strategy.

## Expected Behavior

- `install.md` describes the observable behavior: prompts, output lines, exit codes and env vars.
- It lists every edge case and failure mode with its outcome: no Node or npm, Node below 22.13.0, an unpublished version, `npm i -g` EACCES, a network error, and a client that is already installed. Every case exits `0`.
- It states the testing strategy for #869.
- It has an **Alternatives considered** section.
- Both open points are resolved in the part. Anything that touches another part is moved to the index's **Open points**.

## Solution

Decisions to write into `install.md`, based on the current `arcanum/install/bootstrap.sh` and `installer.sh`:

- **Placement.** The client step runs last in `installer.sh`: after the target-directory prompt, the copy and the `arcanum.json` write, and after the `arcanum installed to <target>` line. A client failure therefore never leaves arcanum half-installed. This resolves the first open point.
- **Confirmation.** The arcanum `[y/N]` trust prompt lives in `bootstrap.sh`, and `ARCANUM_ASSUME_YES` skips it. The client `[Y/n]` prompt is separate. It is asked from `installer.sh` through the shared script (#868), and `ARCANUM_ASSUME_YES` does not answer it.
- **Version.** The target is `arcanum-cli@$VERSION`, using the `VERSION` that `bootstrap.sh` exports.
- **Unpublished version.** The step checks the version with `npm view arcanum-cli@<version> version`. An E404, or empty output, means "not published": warn and skip. Any other `npm view` failure is treated as a network error: warn and skip. This resolves the second open point.
- **Double install.** `installer.sh` already refuses an existing arcanum install, so the only double install it can meet is a client that is already installed. That case links to `already-installed.md` (#865) and is not repeated here.
- **Git clone.** Running `installer.sh` directly from a git clone still needs `REPO` and `VERSION` set. The client step adds no new requirement.
- **Testing (for #869).** bats tests with stubbed `node` and `npm` on `PATH`, one test per failure mode. Each test asserts the warning line and exit `0`. Another test checks that `ARCANUM_SKIP_CLI=1` and the no-TTY case skip without calling `npm`.
- **Migration.** None for this part. The global migration is #872.
- **Owner.** architect (docs). There is no new root folder.

## Benefits

- #869 can implement the installer step straight from the spec.
- Every failure mode has a defined outcome, so a client problem can never break an arcanum install.
