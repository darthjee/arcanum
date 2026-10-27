# Issue: Install or update the arcanum CLI from the arcanum updater

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum). Owner: `scripter`. Depends on #868 (merged: `arcanum/_lib/install_cli.sh`); #869 (merged) wired the same step into the installer.

Wire the shared client step into both update paths, as specified in `docs/agents/specs/cli-install/update.md`:

- the zip path: `arcanum/update/updater.sh`;
- the `git clone` path: `arcanum/update/bootstrap.sh`, which calls the step from the checked-out tree after `git checkout`.

The source of truth is `docs/agents/specs/cli-install.md` and its parts. If the spec turns out to be wrong during implementation, update it in the same PR.

## Problem

Updating arcanum, from either the zip updater or a `git clone` install, never touches the `arcanum-cli` npm package. The client drifts from the arcanum version, and the CLI's version-skew check then fails.

## Expected Behavior

- **Zip path.** After `arcanum updated to <v> at <target>`, `updater.sh` runs `$TARGET/arcanum/_lib/install_cli.sh "$VERSION"`. That is the installed copy, so it outlives `cleanup`. The step runs before `cleanup` removes the release tree and the lock.
- **Git path.** After `git checkout <version>` and `arcanum updated to ...`, `bootstrap.sh` runs `$TARGET/arcanum/_lib/install_cli.sh "$VERSION"` from the checked-out tree. If that file does not exist (an `ARCANUM_VERSION` pin older than the feature), the step is skipped silently.
- **Already on the version.** `Already on <v>.` stays a no-op on both paths: no client step and no prompt.
- **Exit codes.** Both paths exit `0` whatever the client outcome, including a usage error (exit `1`) from `install_cli.sh`. The one exception is exit `4` (`FALLBACK=chat`, opted into with `ARCANUM_CLI_PROMPT=chat`), which both paths propagate with the `FALLBACK=chat` / `CLI_VERSION=` / `CLI_INSTALLED=` stdout lines intact. The arcanum update itself is already complete when that happens.
- **Env passed through.** `ARCANUM_CLI_PROMPT` and `ARCANUM_SKIP_CLI` reach `install_cli.sh` unchanged. Unlike the installer, the updater does not clear `ARCANUM_CLI_PROMPT`, because `/arcanum-update` (#871) opts in through it.
- Every earlier update step keeps its behavior and exit codes: trust prompt, target prompt, missing-install refusal, lock, copy, delete set, `arcanum.json` write, dirty-tree refusal, and `git fetch`/`git checkout`.

## Solution

### Scope

In scope:

- The client-step call in `arcanum/update/updater.sh` (zip path) and in the git branch of `arcanum/update/bootstrap.sh`, plus both scripts' header comments.
- Tests for both paths (below).
- `docs/agents/specs/cli-install.md`'s Status line (the updater caller is no longer pending), and `cli-install/update.md`'s Testing strategy, which should name the new standalone test scripts instead of "bats tests", following #869's precedent.

Out of scope (sibling issues of #861):

- Setting `ARCANUM_CLI_PROMPT=chat` in `run_update_apply`, the `run_update.sh install-cli` subcommand and the skill's exit `4` branch (#871).
- The global migration `next/001` (#872).
- The README and user guide (#873).
- The architecture docs (#874).
- Running the `test_*.sh` scripts in CI (#882).

Until #871 lands, nothing sets the opt-in flag, so in practice exit `4` cannot happen yet.

### Call shape

Zip path, the last step of `updater.sh`, after the `arcanum updated to` line:

```bash
cli_status=0
"${TARGET}/arcanum/_lib/install_cli.sh" "$VERSION" || cli_status=$?
if [[ "$cli_status" -eq 4 ]]; then
  exit 4
fi
```

- `exit 4` still runs the `cleanup` EXIT trap, which removes the release tree and the lock and keeps the exit status.
- Any other non-zero status is ignored, as in the installer.
- No `--no-confirm`: the step asks on the TTY, or skips or falls back per its own rules.

Git path, inside the existing `if [[ "$METHOD" == "git" ]]; then ... fi` block of `bootstrap.sh`, after the `arcanum updated to` line and before its `exit`:

- If `${TARGET}/arcanum/_lib/install_cli.sh` exists, run it with `"$VERSION"`, using the same status capture.
- Exit `4` on status `4`, and `0` otherwise.
- If the file is missing, skip with no output.

**Keep the call inside that `if` block.** `git checkout` rewrites `bootstrap.sh` on disk while bash is still running it. bash parses the whole compound `if` command before executing it, so code inside the block is safe. A top-level command added after the block would be read from the new file, at an arbitrary offset.

### Testing strategy

Two standalone scripts in the style of `arcanum/install/test_installer.sh`. Each uses a stub `install_cli.sh` that records:

- its own path (`$0`) and arguments;
- the `ARCANUM_CLI_PROMPT` it saw;
- the state at call time (`arcanum.json`'s version, or the git HEAD tag);
- whether the release tree still exists.

The stub's exit code is configurable, and on `4` it prints `FALLBACK=chat` and `CLI_VERSION=<v>`. The real `install_cli.sh` is not exercised here: its outcomes are covered by `arcanum/_lib/test_install_cli.sh`.

`arcanum/update/test_updater.sh` builds a fresh fake release tree for each case, because `cleanup` deletes it. The tree holds the real `updater.sh`, the stub `install_cli.sh` and a `MANIFEST`. Each case also gets a `TARGET` with an older `arcanum.json`, and runs with `TARGET`, `REPO` and `VERSION` set. Cases:

- the step is called once, from `$TARGET/arcanum/_lib/install_cli.sh`, with `$VERSION`, after `arcanum.json` holds the new version and after the `arcanum updated to` line;
- `Already on <v>.` makes no call;
- stub exit `4`: the updater exits `4`, the stdout keys come through, and the release tree and lock are removed;
- stub exit `1`: the updater exits `0`;
- an exported `ARCANUM_CLI_PROMPT=chat` reaches the stub unchanged.

`arcanum/update/test_update_bootstrap.sh` (git path) uses a local "origin" repo, whose tags carry the stub `install_cli.sh`, and a clone of it as `TARGET`. It runs the clone's real `bootstrap.sh` with `ARCANUM_ASSUME_YES=1`, `ARCANUM_VERSION` and `ARCANUM_REPO` set, so there is no network call and no `/dev/tty` read. Cases:

- the step is called from the checked-out tree, with `$VERSION`, after the checkout (HEAD is at the tag);
- a tag without `install_cli.sh` is skipped silently with exit `0`;
- `Already on <v>.` makes no call;
- stub exit `4` is propagated with the stdout keys;
- stub exit `1` gives exit `0`.

Both scripts exit `0` with a SKIP message when `git` or `jq` is missing on the host, as `test_installer.sh` does.

### Backward compatibility

Additive only.

- **Zip installs.** The old local `bootstrap.sh` execs the new `updater.sh`, so the client step runs from the first update after the release.
- **`git clone` installs.** The first update still runs the old `bootstrap.sh`, which has no client step. #872 and #873 cover that gap.
- **`/arcanum-update`.** Nothing sets `ARCANUM_CLI_PROMPT=chat` until #871 lands, so the skill gets the no-TTY skip with a warning and exit `0`. An update is never reported as failed.

## Benefits

- Every update path keeps `arcanum-cli` in lockstep with arcanum, so the CLI's version-skew check holds.
- The client step can never break or half-finish an arcanum update. A no-op update stays silent.
- The exit-`4` plumbing is in place for `/arcanum-update` (#871) to ask the question in chat.
- The updater and the git update path gain their first tests.
