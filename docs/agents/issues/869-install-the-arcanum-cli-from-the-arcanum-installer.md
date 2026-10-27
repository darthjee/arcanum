# Issue: Install the arcanum CLI from the arcanum installer

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum). Owner: `scripter`. Depends on #868 (merged: `arcanum/_lib/install_cli.sh`).

Wire the shared client step into `arcanum/install/installer.sh` as specified in `docs/agents/specs/cli-install/install.md`. The source of truth is `docs/agents/specs/cli-install.md` and its parts; if the spec turns out to be wrong during implementation, update it in the same PR.

## Problem

Installing arcanum with the `curl | bash` installer never installs the `arcanum-cli` npm package, so the client stays a separate manual step and can drift from the arcanum version.

## Expected Behavior

- After `arcanum installed to <target>`, the installer runs the client step through `install_cli.sh`, pinned to the `VERSION` that `bootstrap.sh` exports. It asks the `[Y/n]` prompt on the TTY; `ARCANUM_ASSUME_YES` does not answer it, and `ARCANUM_SKIP_CLI` skips it.
- The installer exits `0` whatever the client outcome (installed, skipped, declined, failed with a warning). A client failure always leaves a complete arcanum install, since `arcanum.json` is written first.
- Steps 1 to 4 of the install flow (trust prompt, target prompt, existing-install refusal, copy and `arcanum.json`) keep their behavior and exit codes; aborting the target or hitting an existing install still exits `1` before the client step.
- The installer never exits `4` or prints `FALLBACK=chat`, even if the user exported `ARCANUM_CLI_PROMPT=chat`.

## Solution

### Scope

In scope:

- The client-step call at the end of `arcanum/install/installer.sh`, and the installer's header comment.
- An `ARCANUM_SKIP_CLI` line in `arcanum/install/bootstrap.sh`'s env-var header comment.
- Tests for the installer (below).
- The Status line of `docs/agents/specs/cli-install.md` (the installer caller is no longer pending), and `cli-install/install.md`'s Testing strategy, which should name `arcanum/install/test_installer.sh` for the installer-level tests.

Out of scope (sibling issues of #861): the README and user guide (#873), the architecture docs (#874), the updater (#870), `/arcanum-update` (#871) and the global migration (#872). No migration is needed in this issue.

### Call shape

The last step of `installer.sh`, after the `arcanum installed to <target>` line:

```bash
ARCANUM_CLI_PROMPT= "${SCRIPT_DIR}/../_lib/install_cli.sh" "$VERSION" || true
```

- **`|| true`**: `install_cli.sh` exits `0` on every outcome, but a usage error (exit `1`) must still not fail the arcanum install under `set -e`.
- **`ARCANUM_CLI_PROMPT` cleared**: the installer has no chat to fall back to, so an exported `ARCANUM_CLI_PROMPT=chat` can never leak exit `4` / `FALLBACK=chat` on stdout.
- The script is the release tree's copy (`SCRIPT_DIR`-relative), the same file `cp -R` just placed in the target.
- No `--no-confirm`: the installer always asks on the TTY.

### TTY seam

`installer.sh` reads `/dev/tty` directly for the target-directory prompts. It gets the same test-only seam as `install_cli.sh`: `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"`, used by every `read`. Default behavior is unchanged.

### Testing strategy

A standalone `arcanum/install/test_installer.sh`, in the style of `arcanum/_lib/test_install_cli.sh` (running it in CI is #882). It builds a minimal fake release tree in a temp dir (`arcanum/install/installer.sh`, `arcanum/_lib/install_cli.sh`, a `MANIFEST`), puts stub `node`/`npm` first on `PATH`, and drives the prompts through `ARCANUM_TTY_DEVICE`. Cases:

- the client step runs after `arcanum.json` is written (a complete install exists when the stub `npm` is first called);
- `ARCANUM_SKIP_CLI=1` makes no `node`/`npm` call and exits `0`;
- a client failure (stub `npm i -g` with `EACCES`) still exits `0` with a complete install;
- `ARCANUM_ASSUME_YES=1` does not answer the client prompt;
- an exported `ARCANUM_CLI_PROMPT=chat` yields no exit `4` and no stdout;
- an existing arcanum install and an aborted target confirmation still exit `1`, with no client call.

The per-outcome rows of `install.md`'s Outcomes table are already covered by `test_install_cli.sh` and are not repeated.

### Backward compatibility

Additive only. Running `installer.sh` from a git clone still needs `REPO` and `VERSION` set, with no new requirement.

## Benefits

- A fresh arcanum install gets a matching `arcanum-cli` with one extra `[Y/n]`, keeping the CLI's version-skew check in lockstep.
- The client step can never break or half-finish an arcanum install.
- The installer gains its first tests.
