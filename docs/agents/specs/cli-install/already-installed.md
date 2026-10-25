# CLI Install: Already Installed

Part of the [CLI Install](../cli-install.md) spec. The shared rules (prompt, `ARCANUM_SKIP_CLI`, opt-in `FALLBACK=chat`, no-TTY skip, warn-and-continue) and version pinning live in the index and apply here unchanged.

## Purpose

Define what the client step does when `arcanum-cli` is already installed globally (double installation), for the installer, the updater and the migration alike.

## Decisions

- **Older than the target:** the client is updated in place to `arcanum-cli@<target version>`. It never fails and never produces a duplicate install.
- **Same version as the target:** no-op, with a note that the client is already up to date.
- **Newer than the target** (for example after `arcanum self-update` moved it to `@latest`): left as is, with a note on how to downgrade manually. A newer CLI only sees the config tiers as "behind", which is the safe direction.

## Alternatives considered

- **Auto-downgrading a client that is newer than the target.** Rejected: it would undo a deliberate `arcanum self-update`, and a newer client is safe against older config tiers.

## Open points

- How the installed version is detected: `npm ls -g --json`, `arcanum --version`, or both.
- How a foreign `arcanum` binary on `PATH`, not installed from `arcanum-cli`, is handled.
