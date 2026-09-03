# Issue: Split spec ArcanumUpdateRunUpdateParity

## Description

`core/spec/bin/arcanumUpdateRunUpdateParity_spec.js` is 317 lines — a shell-vs-native parity
suite for the `arcanum-update-run-update-check`/`-apply` migrated entrypoints. Unlike most
oversized specs in this batch it only has 2 top-level `describe` blocks (`check`, `apply`) —
the size instead comes from ~160 lines of shared fixture-building helpers (`runCommand`,
`runPair`, `installBootstrapStub`, `createZipFixture`, `git`, `createGitFixture`) that precede
them, covering both the `zip`-method and `git`-method install-source fixtures each subcommand
is tested against.

## Problem

`check` and `apply` are independent subcommands with their own test bodies, but both currently
sit in one file bundled with all the shared fixture-building code neither half fully needs on
its own (e.g. `apply`'s bootstrap-stub install logic isn't relevant to reading `check`'s
assertions). Splitting by `describe` block alone is coarse here — only 2 natural pieces — so
naively copying the file in two would duplicate ~160 lines of setup.

## Solution

Spec-only reorganization. No changes to `run_update_check_shell.sh`, `run_update_apply_shell.sh`,
or the native `arcanum-update-run-update-check`/`-apply` implementations. No assertions
change — every `it` moves verbatim.

### Split into 2 files + shared helper module

New directory `core/spec/bin/arcanumUpdateRunUpdateParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe block) |
|---|---|
| `check_spec.js` | `check` |
| `apply_spec.js` | `apply` |

Move `runCommand`, `runPair`, `installBootstrapStub`, `createZipFixture`, `git`, and
`createGitFixture` verbatim into a shared support module —
`core/spec/support/factories/arcanumUpdateRunUpdateParitySetup.js`, matching the
`<name>ParitySetup.js` naming already used by every sibling split (e.g.
`autoFixAllWaitCiParitySetup.js`, `queueParitySetup.js`) — imported by both new files. This is
the piece that actually avoids the ~160-line duplication a naive per-describe split would cause.

Each new file also flattens its single nested `describe` into one top-level block suffixed with
the subcommand name (`arcanum-update-run-update-check/-apply parity (shell vs. native) — check`
/ `— apply`), same convention as every sibling split (e.g.
`autoFixAllWaitCiParity/ci_outcomes_spec.js`), rather than keeping the original file's outer
`describe(...)` wrapper. Each file keeps its own trimmed header comment, cross-referencing the
sibling file for the other subcommand's scenarios.

### Done when

- `arcanumUpdateRunUpdateParity_spec.js` is gone; `check_spec.js` and `apply_spec.js` exist
  with every `it` from the original, unchanged.
- The shared-helper module exists and both specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `run_update_check_shell.sh`, `run_update_apply_shell.sh`, or the native
  implementations.

## Benefits

- `check`/`apply` become independently readable without scrolling past the other's setup.
- Shared fixture-building logic lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
