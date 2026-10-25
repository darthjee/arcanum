# CLI Install: Update

Part of the [CLI Install](../cli-install.md) spec. The shared rules (prompt, `ARCANUM_SKIP_CLI`, opt-in `FALLBACK=chat`, no-TTY skip, warn-and-continue) and version pinning live in the index and apply here unchanged.

## Purpose

Make every update path install or update `arcanum-cli@<version>`: the updater (`arcanum/update/`) from its local and `curl | bash` entry points, the `/arcanum-update` skill, and `git clone` installs. Also covers the global migration for installs that update before the client step reaches them.

## Decisions

- **Zip-tracked installs:** the `updater.sh` runs the shared client step. The old local `bootstrap.sh` execs the *new* `updater.sh`, so this works from the first update after the release.
- **`git clone` installs:** `bootstrap.sh`'s git path calls the client step, a separate script, from the checked-out tree after `git checkout`, so every later update runs the new copy. The first update after the release still runs the old `bootstrap.sh`; the README and release notes point those users to `npm i -g arcanum-cli` once.
- **`/arcanum-update`:** the skill opts in to `FALLBACK=chat` with a flag only it sets (for example `ARCANUM_CLI_PROMPT=chat`). On exit `4` it asks the client question with `AskUserQuestion`. An older skill, which does not set the flag, gets the no-TTY skip (see [Backward compatibility](../cli-install.md#backward-compatibility)).
- **Migration:** a global, skippable `next/` entry in `arcanum/migrations/repos/` installs or updates the client with the same rules (version pinning, warn-and-continue, never downgrade). It also closes the `git clone` first-update gap. See [Migration](../cli-install.md#migration).
- The update exits `0` whatever the client outcome.

## Alternatives considered

- **Accepting a one-update lag for `git clone` installs**, with no migration and no documented step. Rejected: those users would silently miss the client on the first update.
- **A repo-scoped migration.** Rejected: the client is installed machine-wide, so it runs once per machine or account, not once per repo.
- **A nudge-only migration** that only tells the user to run `npm i -g arcanum-cli`. Rejected in favor of a migration that installs the client, skippable for users who do not want it.

## Open points

- The name and location of the client-step script that `bootstrap.sh` calls after `git checkout`.
- How `/arcanum-update` resumes the update after the chat answer.
- The migration's `next/NNN` id.
