# Issue: Add a global migration that installs the arcanum CLI

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Add the global migration `arcanum/migrations/repos/next/001.sh`. It installs or updates `arcanum-cli` through the shared client step (`arcanum/_lib/install_cli.sh`, #868), once per machine or account. It also reverses the "No per-repo migration installs it or nudges the user to" rule in `docs/agents/architecture/install-and-release.md`, and switches the docs that cite the pending migration as `next/001` to the full file path.

Source of truth: `docs/agents/specs/cli-install.md` and its parts, mainly [update.md → Global migration](../specs/cli-install/update.md). If the spec turns out to be wrong during implementation, update the spec in the same PR.

## Problem

After #869–#871, new installs and zip updates install the client. Some users still miss it:

- `git clone` installs: the first update after this release runs the old `bootstrap.sh`, which has no client step.
- Anyone who skipped the client step earlier, or whose update ended on `Already on <v>.` (the client step does not run then).
- Existing installs that never update through the new code path at all.

Nothing offers them the client, and `install-and-release.md` still says no migration installs it.

## Expected Behavior

- `/arcanum-migrate` offers `next/001` once per machine or account, as a skippable global migration.
- `[S]kip`: nothing runs, and the global pointer advances.
- `[R]un` (or All in the fallback mode) is the consent. The migration:
  1. Resolves the target version: `.version` from the install's `arcanum.json`, or else `git describe --tags --exact-match` in the install's tree (a `git clone` install).
  2. If neither resolves (a clone on a branch or an untagged commit), warns with the manual `npm i -g arcanum-cli` command and exits `0`.
  3. Otherwise runs `install_cli.sh <version> --no-confirm` and exits `0` whatever the client outcome (warn and continue), so the pointer advances and the user is not asked again.
- `--no-confirm` keeps the [already-installed.md](../specs/cli-install/already-installed.md) rules: never a downgrade, a linked client is left alone, an unreadable one is skipped. `ARCANUM_SKIP_CLI` still skips.
- No second `[Y/n]`, so the migration also works with no TTY (the `/arcanum-migrate` `AskUserQuestion` fallback).

## Solution

### Scope

1. **The migration** (`scripter`):
   - `arcanum/migrations/repos/next/migrations.json`: `[{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "global"}]`. `next/` is empty today; if another migration lands there first, take the next free id and update the spec.
   - `arcanum/migrations/repos/next/001.sh` with the usual `config` / `run` subcommands (`config` prints `{"skippable": true}`).
     - Paths come from the script's own location (`SCRIPT_DIR`), never from the cwd, which is the consuming repo: the install root is `${SCRIPT_DIR}/../../../..` and the shared script is `${SCRIPT_DIR}/../../../_lib/install_cli.sh`. The depth stays the same after `scripts/bump-version.sh` renames `next/` to the version folder.
     - Reads `arcanum.json` with `jq`; falls back to `git -C <install root> describe --tags --exact-match`. Tags are plain versions (`2.2.3`), so the tag is passed as is; a non-semver tag (for example a fork's `v2.2.3`) is rejected by the shared script's own validation, with a warning.
     - Always exits `0`, including when the shared script exits non-zero (for example a usage error `1`).
   - `arcanum/migrations/repos/next/001.md`: the human-readable summary, like the other migrations.
2. **Tests** (`node`): a contract spec in `core/spec/bin/` (for example `migrationsCliInstall_spec.js`), in the style of `migrationsNextStepAuto_spec.js`. It runs the real `001.sh` from a fake install tree whose `arcanum/_lib/install_cli.sh` is a stub that records its arguments and exits with a configurable code. Cases:
   - `config` prints `{"skippable": true}`; an unknown subcommand exits `1`.
   - Version from `arcanum.json`.
   - Version from an exact tag on a git clone (no `arcanum.json`).
   - An untagged commit: a warning naming the manual command, no stub call, exit `0`.
   - The stub is called with `<version> --no-confirm`, from the install tree.
   - A non-zero stub exit still gives exit `0`.

   The migration path is one full string literal (`'arcanum/migrations/repos/next/001.sh'`), per the spec convention in [Per-Repo Migrations](../architecture/per-repo-migrations.md), so `bump-version.sh` rewrites it on release. The spec's Testing strategy says "bats tests", but the repo has none; migrations are tested with Jest contract specs. Fix that line in `update.md`.
3. **Docs** (`architect`):
   - `docs/agents/architecture/install-and-release.md`: drop "No per-repo migration installs it or nudges the user to", and describe the migration (global, skippable, pinned, `--no-confirm`, warn and continue), citing `arcanum/migrations/repos/next/001.sh`.
   - Switch the `next/001` citations in `docs/agents/specs/cli-install.md`, `cli-install/update.md`, `cli-install/already-installed.md` and `cli-install/self-update.md` to `arcanum/migrations/repos/next/001.sh`, and drop the "until #872 creates the file" notes. Leave `docs/agents/specs/shell-engine-removal.md`'s `next/001` alone: it names a different, already-shipped migration (#601).
   - `docs/agents/specs/cli-install.md` Status line: the migration exists too.
   - `docs/agents/architecture/per-repo-migrations.md`: add the migration to any list of global migrations, if there is one.

### Checks

- `scripts/bump-version.sh`'s guard finds no stale `repos/next/NNN` reference (every cited `next/001` has its file).
- `scripts/test_bump_version.sh` still passes.

## Benefits

- Closes the `git clone` first-update gap and reaches every existing install, once per machine.
- The user decides once, at the usual migration prompt; skipping is remembered.
- Same rules as every other client path, because it reuses the shared script.
