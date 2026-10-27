# Issue: Document installing and updating the arcanum CLI with arcanum

## Description
Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Update the user-facing docs now that every implementation part of the CLI install spec is merged: the installer (#869), the updater (#870), `/arcanum-update` (#871), `arcanum self-update` (#867) and the global migration (#872).

Source of truth: `docs/agents/specs/cli-install.md` and its parts. If the spec turns out to be wrong, update it in the same PR.

## Problem
The user docs still describe the CLI as a separate, manual step:

- `README.md`'s Installation and Updating sections don't mention the client prompt, `ARCANUM_SKIP_CLI`, or that `ARCANUM_ASSUME_YES` does not answer it.
- `README.md`'s Arcanum CLI section and `docs/guides/arcanum-cli.md`'s intro ("installed separately from Arcanum") and Setup only show `npm i -g arcanum-cli`.
- Nothing tells `git clone` users that their first update after this release runs the old `bootstrap.sh`, which has no client step.

## Expected Behavior
A reader of the README or the CLI guide learns that installing or updating arcanum offers to install or update `arcanum-cli`, how to skip it, what happens without a TTY, and what to do once for an old `git clone` install.

## Solution
Docs only, owned by `architect`. No code or tests.

### `README.md`
- **Installation, Option 1:** after the arcanum confirmation, a separate `[Y/n]` prompt offers `arcanum-cli@<version>` via `npm i -g` (default yes, read from `/dev/tty`). `ARCANUM_SKIP_CLI=1` skips it without calling `node`/`npm`. `ARCANUM_ASSUME_YES` does not answer it. With no TTY the step is skipped with a warning naming the manual command. A failed client step only warns; it never fails the arcanum install. Needs Node.js 22.13.0+.
- **Installation, Option 2 (`git clone`):** the clone gets no client; install it with `npm i -g arcanum-cli`, or accept the global migration on the next `/arcanum-migrate`.
- **Updating:** both the zip and the git paths run the same client step after the update (same prompt, `ARCANUM_SKIP_CLI`, no-TTY rules). An already-installed client is updated to the target version; a newer or `npm link`ed one is left alone. `/arcanum-update` asks the same question in chat.
- **One-time note for `git clone` installs:** the first update after this release runs the old `bootstrap.sh`, which has no client step. Run `npm i -g arcanum-cli` once, or accept the global migration `arcanum/migrations/repos/next/001.sh` (cited by full path so `scripts/bump-version.sh` rewrites it on release).
- **Arcanum CLI section:** the installer and updater offer the CLI; `npm i -g arcanum-cli` stays as the manual route; `arcanum self-update` updates it later.

### `docs/guides/arcanum-cli.md`
- Intro: replace "installed separately from Arcanum" with "offered when you install or update Arcanum, and installable on its own".
- Setup: the same offer, `ARCANUM_SKIP_CLI=1`, the manual `npm i -g arcanum-cli`, and a pointer to the README one-time note. The existing "Updating the CLI" (`arcanum self-update`) section stays; check it against [self-update.md](docs/agents/specs/cli-install/self-update.md).

### `cli/README.md`
- One line: the arcanum installer and updater also offer to install it.

### Out of scope
- GitHub release notes: written at release time, not in the repo.
- Architecture docs (#874) and removing the spec (#875).

### Checks
- Prompt and warning wording matches the Outcomes tables in `install.md` and `already-installed.md`.
- Every `next/001` citation uses the full path.

## Benefits
Users know the CLI now comes with arcanum, can opt out, and `git clone` users don't silently miss the client on their first update.
