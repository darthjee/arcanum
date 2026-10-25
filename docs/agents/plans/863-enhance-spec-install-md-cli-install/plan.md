# Plan: Enhance spec: install.md (CLI install)

Issue: [863-enhance-spec-install-md-cli-install.md](../../issues/863-enhance-spec-install-md-cli-install.md)

## Overview

Turn `docs/agents/specs/cli-install/install.md` from the skeleton merged in #862 into a complete design that #869 can implement without reopening epic #861. Docs only, owned by the architect.

## Context

The skeleton records the decisions but leaves two open points: where the client step runs relative to the target-directory prompt, and how an unpublished `arcanum-cli` version is detected. In today's code, the arcanum `[y/N]` trust prompt lives in `arcanum/install/bootstrap.sh`, and `ARCANUM_ASSUME_YES` skips it. `arcanum/install/installer.sh` asks for the target directory, refuses an existing `arcanum.json`, copies the tree, writes `arcanum.json` and prints `arcanum installed to <target>`. `VERSION` is exported by `bootstrap.sh`.

## Implementation Steps

### Step 1 — Complete install.md

Rewrite `docs/agents/specs/cli-install/install.md`. Keep its sections (Purpose / Decisions / Alternatives considered / Open points) and add the following:

- **Flow.** A numbered flow:
  1. bootstrap `[y/N]`.
  2. Target-directory prompt.
  3. Copy and write `arcanum.json`.
  4. Print `arcanum installed to <target>`.
  5. The client step, through the shared script from #868. It is the last step.
- **Prompt.** A separate `[Y/n]` prompt (default yes), read from `/dev/tty`:
  - `ARCANUM_SKIP_CLI=1` skips it.
  - `ARCANUM_ASSUME_YES` does not answer it.
  - With no TTY, skip it with a warning.
  - Exact wording stays an index open point.
- **Target.** `arcanum-cli@$VERSION`.
- **Unpublished version.** Detect it with `npm view arcanum-cli@<version> version`:
  - E404 or empty output means "not published": warn and skip.
  - Any other failure is treated as a network error: warn and skip.
- **Outcome table.** One row per case, with the condition, the output line (warning or info) and the exit code (always `0`). The cases are:
  - installed;
  - skipped by env;
  - skipped with no TTY;
  - declined;
  - no Node or npm;
  - Node < 22.13.0;
  - unpublished version;
  - EACCES (no sudo retry, with a hint);
  - network error;
  - client already installed (link to [already-installed.md](already-installed.md)).
- **Git clone.** Running `installer.sh` directly still needs `REPO`/`VERSION`. The client step adds no new requirement.
- **Testing strategy for #869.** bats tests with stubbed `node`/`npm` on `PATH`, one test per failure mode, each asserting the warning line and exit `0`. Another test checks that `ARCANUM_SKIP_CLI=1` and the no-TTY case never call `npm`.
- **Alternatives considered.** Add these to the existing entry:
  - Running the client step before the copy. Rejected, because a client failure could abort a half-done install.
  - Prompting inside `bootstrap.sh`. Rejected, because the bootstrap must stay minimal.
  - Treating every `npm view` failure as "not published". Rejected, because it hides network errors.
- **Open points.** Remove the two resolved ones. Anything left that touches another part moves to the index.

### Step 2 — Update the index

In `docs/agents/specs/cli-install.md`, make sure the **Open points** section no longer lists anything resolved by Step 1, and that any point Step 1 moved there is added. Check that every relative link in both files resolves.

## Files to Change

- `docs/agents/specs/cli-install/install.md`: complete the part (Step 1).
- `docs/agents/specs/cli-install.md`: sync the open points (Step 2).

## Notes

- This plan changes no scripts or code. The implementation is #869, and the shared script is #868.
- The exact prompt and warning wording stays an index open point, shared by every part.
- No migration is needed. The global migration is #872.
