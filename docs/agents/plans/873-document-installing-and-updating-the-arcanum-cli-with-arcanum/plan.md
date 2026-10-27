# Plan: Document installing and updating the arcanum CLI with arcanum

Issue: [873-document-installing-and-updating-the-arcanum-cli-with-arcanum.md](../../issues/873-document-installing-and-updating-the-arcanum-cli-with-arcanum.md)

## Overview

Docs only. Update the README, the CLI user guide and `cli/README.md` so they say that installing or updating arcanum now offers to install or update `arcanum-cli`. They also need to say how to skip that offer, what happens without a TTY, and the one-time step for `git clone` installs. No code or tests change.

## Context

Every implementation part of the [CLI Install spec](../../specs/cli-install.md) is merged:

- `arcanum self-update` (#867)
- the shared `arcanum/_lib/install_cli.sh` (#868)
- the installer (#869)
- the updater (#870)
- `/arcanum-update` (#871)
- the global migration `arcanum/migrations/repos/next/001.sh` (#872)

The user docs still describe the CLI as a separate, manual install. The guide already documents `arcanum self-update` (#867), so that section only needs a check against [self-update.md](../../specs/cli-install/self-update.md).

The spec and its parts are the source of truth. Take every user-visible string from the Outcomes tables in [install.md](../../specs/cli-install/install.md#outcomes) and [already-installed.md](../../specs/cli-install/already-installed.md#outcomes). If a doc and the spec disagree, check the code (`arcanum/_lib/install_cli.sh`). If the spec turns out to be wrong, fix it in the same PR.

The architect owns this plan. `README.md` is a root-level file. `docs/guides/arcanum-cli.md` and `cli/README.md` are in the `client` agent's scope, but they are short prose changes that must stay consistent with the README. The architect writes all three and may ask `client` to review the two client-owned files.

## Implementation Steps

### Step 1 — `README.md`

**Installation, Option 1 (`curl | bash`).** After the existing paragraph on the arcanum `[y/N]` confirmation, add a paragraph on the client step:

- After the arcanum install, a separate prompt asks `Install arcanum-cli@<version> globally (npm i -g)? [Y/n]`. It defaults to yes, reads from `/dev/tty`, and pins `<version>` to the arcanum version being installed.
- `ARCANUM_SKIP_CLI=1` skips the step without asking and without calling `node` or `npm`.
- `ARCANUM_ASSUME_YES` does **not** answer this prompt; it only skips the arcanum confirmation.
- The step needs Node.js 22.13.0 or newer and npm.
- With no TTY, or if anything fails (no Node or npm, Node too old, `EACCES`, network), the step warns and names the manual command. The arcanum install still succeeds.
- An already-installed client is updated to the target version. A newer or `npm link`ed client is left as is.
- Keep the `ARCANUM_SKIP_CLI=1` example as a one-off prefix on the command, like the existing `ARCANUM_ASSUME_YES` wording.

**Installation, Option 2 (`git clone`).** Add one sentence: a clone does not install the CLI. Install it with `npm i -g arcanum-cli`, or accept the global migration the next time you run `/arcanum-migrate`.

**Updating.**

- Add a paragraph saying both update methods, the release zip and `git fetch`/`git checkout`, run the same client step afterwards, with the same prompt, `ARCANUM_SKIP_CLI`, no-TTY and warn-and-continue rules.
- Add one sentence on `/arcanum-update`: it asks the same question in chat (`AskUserQuestion`), because the session has no TTY.
- Add a short **one-time note for `git clone` installs**. The first update after this release still runs the old `bootstrap.sh`, which has no client step. Run `npm i -g arcanum-cli` once, or accept the global migration `arcanum/migrations/repos/next/001.sh` in `/arcanum-migrate`. Choosing `[R]un` there is the consent, and `[S]kip` is remembered.
- Cite the migration by that full path so `scripts/bump-version.sh` rewrites it on release. See the "Referencing pending migrations" rule in [Per-Repo Migrations](../../architecture/per-repo-migrations.md).

**Arcanum CLI section.**

- Reword the intro: the installer and the updater offer to install the CLI, and `npm i -g arcanum-cli` remains the manual route. Keep the Node.js 22.13.0 requirement.
- Add one line: `arcanum self-update` updates it later.

### Step 2 — `docs/guides/arcanum-cli.md` and `cli/README.md`

**Guide intro.** Replace "It is optional, and it is installed separately from Arcanum." with wording that says it is optional, that the Arcanum installer and updater offer it, and that it can also be installed on its own. Keep the sentence about `core/bin/arcanum` not being on `PATH`.

**Guide Setup.**

- Before the `npm i -g arcanum-cli` block, add a short paragraph. Installing or updating Arcanum asks whether to install or update the CLI, at the same version. `ARCANUM_SKIP_CLI=1` skips that question. Answering no, or having no TTY, prints the manual command.
- Point to the README's one-time note for `git clone` installs and to the global migration, `arcanum/migrations/repos/next/001.sh`, cited by full path.
- Keep the manual block as the way to install it on its own.

**Guide "Updating the CLI".** Leave it unchanged unless it contradicts [self-update.md](../../specs/cli-install/self-update.md). Add one sentence that updating Arcanum also offers to update the CLI to the matching version, while `arcanum self-update` goes to the latest release.

**`cli/README.md`.** Under the install block, add one line: the Arcanum installer and updater also offer to install it, and `arcanum self-update` updates it later. Check first whether #867 already added the `self-update` line. If it did, extend that line rather than duplicating it.

## Files to Change

- `README.md`: Installation (Options 1 and 2), Updating (client step, `/arcanum-update`, one-time `git clone` note) and the Arcanum CLI section.
- `docs/guides/arcanum-cli.md`: the intro, Setup and one sentence in "Updating the CLI".
- `cli/README.md`: one install line.

## Notes

- Out of scope:
  - GitHub release notes, which are written at release time and not kept in the repo.
  - The architecture docs (#874).
  - Removing the spec (#875).
  - `docs/agents/architecture/arcanum-cli.md` already says "Optional, offered with Arcanum", so it needs no change here.
- Every `next/001` citation must be the full path `arcanum/migrations/repos/next/001.sh`, never `next/001` alone.
- Don't copy the whole Outcomes tables into the user docs. Quote the prompt line and describe the rest in prose; the spec stays the reference.
- `docs/guides/arcanum-repo-config.md` and `docs/guides/arcanum-global-config.md` mention `npm i -g arcanum-cli` only as a pointer to the CLI. Leave them alone.
