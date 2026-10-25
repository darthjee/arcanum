# Plan: Enhance spec: self-update.md (CLI install)

Issue: [866-enhance-spec-self-update-md-cli-install.md](../../issues/866-enhance-spec-self-update-md-cli-install.md)

## Overview

Turn `docs/agents/specs/cli-install/self-update.md` from its skeleton into the complete design of the `arcanum self-update` CLI command, recording every decision from the issue's Solution, then align the spec index with it. Docs only: no code, no script, no migration.

## Context

The skeleton only names the command and says it runs `npm i -g arcanum-cli@latest`; its open points are the `--json` shape, the exit codes and how npm failures map onto `cli/lib/exitCodes.js`. The issue settled them:

- Resolve `latest` with a bounded `npm view`, validate it as a semver, compare it with the running `CLI_VERSION` (same semver precedence as [already-installed.md](../../specs/cli-install/already-installed.md#version-comparison)), and install that exact version with `npm i -g --ignore-scripts "arcanum-cli@<v>"` only when the running copy is older; verify by reading the installed `package.json`.
- Before any network call, check that the running copy is the global install (`realpath` of the running package vs `realpath "$(npm root -g)/arcanum-cli"`): a linked checkout or a non-global copy (`npx`, project-local, source run) is refused.
- No prompt. Outcomes `updated`, `up_to_date`, `newer` exit `0`; refusals exit `4` (`target_unavailable`, reused); every npm failure exits a new `8` (`npm`).
- `--json` prints one `{"status","from","to","latest"}` object.

Siblings already merged (#863, #864, #865) set the part's shape: Purpose, Decisions (with subsections), Flow, Outcomes, Edge cases, Names, Testing strategy, Alternatives considered, Open points.

## Implementation Steps

### Step 1 — Complete `self-update.md`

Rewrite `docs/agents/specs/cli-install/self-update.md` following the sibling parts' structure, keeping its existing intro line, Purpose, the naming decision and the two existing alternatives:

- **Decisions**, as subsections:
  - *What it runs*: resolve, compare, install the exact version; never a blind `@latest`; never downgrades (a rollback belongs to the out-of-scope version argument).
  - *Running copy vs global install*: the detection by `realpath` and `npm root -g`, done before `npm view`; the case table (global, linked, not the global copy, `npm root -g` failing).
  - *No confirmation*: the command is the consent; the progress note before `npm i -g`.
  - *Shared rules*: the table of how each index [shared rule](../../specs/cli-install.md#shared-rules) applies, including `ARCANUM_SKIP_CLI` ignored and no warn-and-continue.
  - *Exit codes*: the table (`0`, `4` reused, new `8` `npm`, `1`/`2`), the `ENOENT` → `7` trap and the requirement to wrap npm failures in an `NpmError`; the code is added, never renumbered.
  - *`--help`*: the top-level row, the command usage, no positionals, targeting flags as usage errors.
- **Flow**: the ordered steps: platform check (`win32` error) → arity/flags → `npm root -g` and the global-copy check → `npm view` (bounded) → semver validation → compare → progress note → `npm i -g --ignore-scripts` → `package.json` verification → result.
- **Outcomes**: one table with every outcome and failure, each with its human stderr/stdout line, its `--json` `status` or error `code`, and its exit code; npm output captured (shown only on failure, or under `ARCANUM_DEBUG=1`).
- **Edge cases**: the issue's table (mid-run replacement, nvm, symlinked bin, prereleases, concurrent runs, Ctrl-C → `130`, Windows).
- **Names**: `self-update`, `EXIT_NPM` / `npm` (`8`), `NpmError`, `cli/lib/commands/selfUpdate.js`, the `status` enum values.
- **Docs the implementation updates**: `docs/guides/arcanum-cli.md` (Setup, Troubleshooting), `cli/README.md`, `docs/agents/architecture/arcanum-cli.md` (Commands, Exit codes, JSON output, Module layout); `cli/lib/skew.js`'s hint unchanged.
- **Testing strategy**: injected `deps` (fake `execFileAsync`, `realpath`, `lstat`, `package.json` read, `process.platform`), one spec per outcome/failure/edge row, exact-argv specs, `exitCodes_spec.js`, `help_spec.js`/`main_spec.js`, no real-install CI smoke test, the manual pre-release check.
- **Security and performance**, **Backward compatibility** (additive; no migration).
- **Alternatives considered**: keep the two existing entries and add the seven from the issue.
- **Open points**: "None left." (the wording of messages stays covered by the index's open point).

### Step 2 — Align the spec index and check links

In `docs/agents/specs/cli-install.md`:

- *Version pinning*: the `self-update` line says it resolves `latest` and installs that exact version.
- *Shared rules*: one sentence noting that the rules govern the installer, updater and migration client step; `arcanum self-update` applies them as listed in its part (it ignores `ARCANUM_SKIP_CLI`, has no prompt, and fails instead of warning).
- *Parts* table: expand the `self-update.md` row (resolve-and-pin to `latest`, refuses a linked or non-global copy, no prompt, new exit code `8`).

Then check every relative link and anchor in the changed files resolves (including links into `already-installed.md` and the index), and that no doc cites a `repos/next/NNN` path (only `next/001`).

## Files to Change

- `docs/agents/specs/cli-install/self-update.md` — the complete part (Step 1).
- `docs/agents/specs/cli-install.md` — Version pinning line, Shared rules note, Parts row (Step 2).

## Notes

- Docs only: the implementation (the `client` agent's `cli/lib/commands/selfUpdate.js`, `exitCodes.js`, help, guide and architecture-doc updates) is a later issue of epic #861; this spec only lists those changes.
- Exit code `8` is a new stable code; the spec must say it is added to the architecture doc's Exit codes table by the implementation, not by this issue.
- Message wording stays open under the index's "exact wording" open point (#868).
