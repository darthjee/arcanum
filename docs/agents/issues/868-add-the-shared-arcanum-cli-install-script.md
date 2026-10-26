# Issue: Add the shared arcanum-cli install script

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Add one shared bash script, `arcanum/_lib/install_cli.sh`, that owns the whole client step (installing or updating `arcanum-cli` globally with npm), plus its tests. The installer (#869), the updater and `bootstrap.sh` git path (#870), `/arcanum-update` (#871) and the global migration (#872) all call this script, so they share the same rules. Wiring those callers is out of scope here.

Source of truth: `docs/agents/specs/cli-install.md` and its parts (`install.md`, `already-installed.md`, `update.md`), including the step order in `already-installed.md`'s Flow. If the spec turns out to be wrong during implementation, update the spec in the same PR.

Owner: `scripter`.

## Problem

Installing or updating arcanum never touches the `arcanum-cli` npm package, so the client is a separate, manual step and drifts out of lockstep with arcanum. Four callers need to install or update the client under identical rules (prompt, opt-outs, version pinning, never-downgrade, warn-and-continue). Without one shared script, each caller would reimplement them and drift apart.

## Expected Behavior

`arcanum/_lib/install_cli.sh <version> [--no-confirm]` runs the client step in the spec's order:

1. `ARCANUM_SKIP_CLI` set (any non-empty value): info line, skip, no `node` or `npm` call.
2. `<version>` not plain semver (`MAJOR.MINOR.PATCH[-prerelease]`): warning, skip, no `npm` call.
3. No TTY: with `--no-confirm` (the `/arcanum-update` resume and the migration, which both run without a TTY) or `ARCANUM_CLI_PROMPT=chat` (the question becomes exit `4` at step 7), carry on; otherwise warn and skip, no `npm` call. The TTY is only probed when it is needed, so `--no-confirm` never opens `/dev/tty`.
4. `node` and `npm` on `PATH`, and Node at least `22.13.0`; otherwise warn and skip.
5. Detect the installed client with `npm ls -g --json --depth=0 arcanum-cli`, parsed (and compared) by a `node -e` wrapper bounded by `spawnSync` with a ~15 s timeout, printing `CLI_STATE` (`missing`, `older`, `same`, `newer`, `linked`, `unknown`) and `CLI_INSTALLED` when known:
   - `same`, `newer`, `linked`: info line, done;
   - `unknown`: warning, done;
   - `older`, `missing`: continue.
6. `npm view arcanum-cli@<v> version --fetch-retries=0 --fetch-timeout=<~15 s>`: `E404` or empty output means unpublished, any other failure means a network error; either way warn and skip.
7. Ask the `[Y/n]` prompt on `/dev/tty` (default yes; install or update wording), unless `--no-confirm` was passed. With no TTY and `ARCANUM_CLI_PROMPT=chat`: print `FALLBACK=chat`, `CLI_VERSION=<v>` and, when a client is installed, `CLI_INSTALLED=<v>` on stdout, and exit `4`. A "no" answer is an info line with the manual command.
8. `npm i -g --ignore-scripts "arcanum-cli@<v>"`. `EACCES`, `EEXIST`, network or any other failure: warning with the reason and the manual command. Never `sudo`, never `--force`, never a retry.
9. When the step ends with the client present (installed, updated, unchanged, newer kept): compare the resolved directory of `command -v arcanum` with `$(npm prefix -g)/bin`, and warn when `arcanum` resolves elsewhere or is not on `PATH`.

Every outcome exits `0`, except the opt-in exit `4` and a usage error (missing or extra arguments), which exits `1`. `ARCANUM_ASSUME_YES` never answers the client prompt. `--no-confirm` only answers the prompt: it never downgrades, leaves `linked` alone and skips `unknown`.

## Solution

#### Interface

```text
arcanum/_lib/install_cli.sh <version> [--no-confirm]
```

- `<version>`: the target `arcanum-cli` version, validated before any `npm` call.
- `--no-confirm`: pre-answers the prompt. Consent is only ever an argument, never an env var.
- No repo or install path argument: nothing in the flow needs one.
- Env: `ARCANUM_SKIP_CLI`, `ARCANUM_CLI_PROMPT=chat`, plus the test-only seams below.

#### Plain bash, no engine dispatch

The script is plain bash: no `engine_dispatch` shim, no `_shell.sh` twin, no native implementation in `core/`, and no `migration-status.json` entry. It runs from `installer.sh` and `bootstrap.sh`, outside any configured repo, and must use the host's `npm`. Add one line to `docs/agents/architecture/script-engine.md` recording this exception.

#### Node floor

- Hard-code `22.13.0` in the script: `cli/` is not in the release zip, so `cli/package.json` cannot be read at install time.
- A test reads `engines.node` from `cli/package.json` in the repo and fails if it no longer matches the script's constant.

#### Version comparison

Semver precedence inside the `node -e` wrapper (about 15 lines of plain JS, no `semver` dependency), as specified in `already-installed.md`'s Version comparison: numeric `MAJOR.MINOR.PATCH`, a prerelease lower than its release, prerelease identifiers compared one by one (numeric numerically, others in ASCII order, numeric before alphanumeric), build metadata ignored. A linked install (`link: true` or `resolved: "file:…"`) is `linked` whatever its version.

#### Wording

All lines go to stderr, prefixed `arcanum-cli:`. This closes the spec's last open point.

- Install prompt: `Install arcanum-cli@<v> globally (npm i -g)? [Y/n]`
- Update prompt: `Update arcanum-cli <old> → <new> (npm i -g)? [Y/n]`
- Warnings: `arcanum-cli: warning: <reason>. Install it manually with: npm i -g arcanum-cli@<v>`
- Info lines: `arcanum-cli: <message>`

Write the final wording into the Outcomes tables of `install.md` and `already-installed.md`, and set the index's Open points to "None".

#### Spec fix: `--no-confirm` without a TTY

`already-installed.md`'s Flow step 3 (and `install.md`'s Flow step 5.2) skip on "no TTY and no opt-in flag", which would make the `/arcanum-update` resume and the migration, both run with `--no-confirm` and no TTY, always skip. Change them to "no TTY, no `--no-confirm` and no `ARCANUM_CLI_PROMPT=chat`: skip with a warning". With `--no-confirm` the script never opens `/dev/tty`.

#### Tests

- A standalone `arcanum/_lib/test_install_cli.sh`, in the same style as `arcanum/_lib/test_lock.sh` (the repo has no bats). Change the spec's "bats tests" wording to "standalone shell tests" in `install.md` and `already-installed.md`.
- Stub `npm` and `node` executables first on `PATH`, recording their calls and returning canned output and exit codes. The `node -e` wrapper itself runs on the real `node`, so the stub `node` only fakes `--version` and delegates everything else.
- Test-only seams: `ARCANUM_TTY_DEVICE` (as in `next_step_prompt_shell.sh`) to drive or remove the TTY, and an env seam to shorten the `npm ls` / `npm view` timeouts.
- Cover every row of the Outcomes tables in `install.md` and `already-installed.md`, the semver comparison (table-driven), the no-`npm`-call paths, `ARCANUM_ASSUME_YES` not answering the prompt, `--no-confirm` with a newer client, the exit-`4` output, the `PATH` check and the Node-floor drift check.
- Running the standalone shell tests in CI is out of scope: see #882.

#### Out of scope

- Calling the script from the installer (#869), the updater and `bootstrap.sh` (#870), `/arcanum-update` (#871) and the migration (#872).
- Running the standalone shell tests in CI (#882).

## Benefits

- One implementation of the client-step rules for all four callers, so they cannot drift.
- The callers' issues (#869–#872) shrink to wiring and propagating exit `4`.
- The spec's last open point (wording) is closed, and its test wording matches the repo's conventions.
