# Spec: CLI Install

## Status

Proposed. Nothing in this spec is implemented yet.

## Origin

Origin: epic #861; this spec supersedes the epic body.

From this spec's merge on, this file and its parts are the source of truth for the design. The epic body is a discussion snapshot and is no longer maintained.

## Goal

Installing or updating arcanum also installs or updates the `arcanum-cli` npm package, and the CLI can update itself. Today the client is a separate, manual step: neither installing arcanum nor `/arcanum-update` touches it.

## Scope

In scope:

- The `curl | bash` installer (`arcanum/install/`) installs `arcanum-cli` as part of installing arcanum.
- The updater (`arcanum/update/`), from both its local and its `curl | bash` entry points, installs or updates `arcanum-cli`.
- The `/arcanum-update` skill, which runs the same update flow, picks up the client update too.
- `git clone` installs (README Option 2) also get the client, through the update path and a documented one-time step.
- **Double installation:** the client is already installed globally. Installing or updating arcanum then updates the existing `arcanum-cli` to the target version, and must not fail or produce a duplicate install.
- A new CLI command, `arcanum self-update`, that updates the client itself. Today the CLI only has `config`.

Out of scope:

- Changing the arcanum installer's own behavior when the target directory already has an arcanum install. It keeps refusing and pointing to `update`.
- Installing Node.js or npm when they are missing.
- Uninstalling the client.

## Shared rules

Every part relies on these rules. The parts reference them and do not repeat them.

- **Prompt.** After the existing arcanum confirmation, a separate prompt asks whether to install or update the client. It names the target (`arcanum-cli@<version>`, via `npm i -g`), defaults to yes (`[Y/n]`), and reads from `/dev/tty`.
- **`ARCANUM_SKIP_CLI`**: any non-empty value (docs show `ARCANUM_SKIP_CLI=1`) skips the client step without asking and without calling `node` or `npm`.
- **`ARCANUM_ASSUME_YES=1`** does **not** answer the client prompt. It still only skips the main arcanum confirmation.
- **Opt-in `FALLBACK=chat`.** Inside `/arcanum-update` there is no `/dev/tty`. The client step exits `4` with `FALLBACK=chat` (and `CLI_VERSION=<v>`) only when the caller opts in with `ARCANUM_CLI_PROMPT=chat`, which only the new skill sets. Any other value, or unset, keeps the no-TTY skip. The flag only asks; it never consents. The skill then asks the same question with `AskUserQuestion`, following the project's TTY-first convention.
- **No-TTY skip.** With no TTY, no `ARCANUM_SKIP_CLI` and no opt-in flag, the client step is skipped with a warning naming the manual command. It never hangs and never fails the arcanum install or update.
- **Warn and continue.** Any client failure warns with the reason and the manual command, and never fails arcanum: the arcanum install or update still exits `0`. This covers:
  - Node or npm missing;
  - Node below the CLI's floor (22.13.0);
  - `npm i -g` failing, for example EACCES on a global prefix that needs `sudo`, or a network error.

  The step never retries with `sudo`.

- **Validated version.** The shared script validates `VERSION` as a plain semver (`MAJOR.MINOR.PATCH[-prerelease]`) before any `npm` call. Anything else is a warning and a skip, never an `npm` call. `VERSION` comes from `ARCANUM_VERSION` or a GitHub `tag_name`, and on `/arcanum-update` it travels through `CLI_VERSION=` and back as an argument.
- **Exact pin, one argument, no install scripts.** The install is always `npm i -g --ignore-scripts arcanum-cli@<v>`, with `arcanum-cli@<v>` passed as one quoted argument. It is never a range or a dist-tag, so the version installed is the version named in the prompt. `arcanum-cli` has no dependencies and no install-time scripts, so `--ignore-scripts` loses nothing, and a compromised publish cannot run code at install time.
- **Consent only by argument.** The pre-answer that skips the `[Y/n]` prompt is the shared script's `--no-confirm` argument, used only by the `/arcanum-update` resume and the migration. It is never an env var, so an exported variable cannot silently consent to a machine-wide install. `ARCANUM_SKIP_CLI` can only *skip*. `--no-confirm` only answers the prompt and never bypasses the installed-version check: it never downgrades, leaves a linked dev checkout alone, and skips an unreadable install (see [already-installed.md](cli-install/already-installed.md)).
- **Bounded `npm view`.** `npm view` runs with `--fetch-retries=0` and a bounded `--fetch-timeout` (about 15 seconds), so an offline machine warns quickly instead of stalling. A timeout means "network error, warn and skip". `npm i -g` keeps npm's defaults: the user has consented and is waiting for it.
- **npm config honored.** The user's npm config (registry, proxy, prefix) is used as is. The step passes no registry override.
- **Forks.** The package name is always `arcanum-cli` on the user's configured npm registry, whatever `ARCANUM_REPO` is. A fork whose tag matches an official version gets the official client of that version. This is documented, not special-cased.
- **Skipped paths cost nothing.** `ARCANUM_SKIP_CLI`, a no-TTY run without the flag, `Already on <v>` and a git checkout without the script make no `npm` call. Otherwise the local installed-version check (`npm ls`) runs first, so an unchanged, newer or linked client costs one local `npm ls` and no network call. Only an install or update that would actually happen adds one `npm view` before asking, plus `npm i -g` after consent.

## Version pinning

- The installer and updater install `arcanum-cli@<the arcanum version being installed>`, not `@latest`. This keeps the lockstep the CLI's version-skew check relies on, and honors `ARCANUM_VERSION` pins.
- If that version is not on npm, the client is left untouched, with a warning naming the manual `npm i -g arcanum-cli` command. Examples: a fork's own version, or an arcanum release older than the first CLI publish. The arcanum install or update still succeeds.
- `arcanum self-update` stays on `@latest`. See [self-update.md](cli-install/self-update.md).

## Backward compatibility

The feature only adds behavior. No config shape changes, and existing installs keep working. The risk is in which copy of the scripts runs during the first update after this ships.

- **Zip-tracked installs.** The old local `arcanum/update/bootstrap.sh` downloads the new release and execs the *new* `updater.sh`, so the client step runs on the first update. No special handling is needed.
- **`git clone` installs.** `bootstrap.sh` updates directly with `git fetch`/`git checkout` and never runs `updater.sh`. The client step goes in a separate script that `bootstrap.sh` calls *from the checked-out tree* after the checkout, so every later update runs the new copy. The first update after the release still runs the old `bootstrap.sh`, which has no client step. The README and release notes point those users to `npm i -g arcanum-cli` once.
- **An older `/arcanum-update` session** does not know the new exit `4` / `FALLBACK=chat`. Because the client step only exits `4` when the caller opts in (see [Shared rules](#shared-rules)), an old skill gets the no-TTY behavior instead: the client is skipped with a warning and the update exits `0`. An old skill therefore never reports a successful arcanum update as failed.

## Migration

A migration is needed.

- A `next/` entry in `arcanum/migrations/repos/` with `applies_to: "global"` and `skippable: true`. It installs or updates `arcanum-cli@<version>` with the same rules as the installer and updater: version pinning, warn-and-continue on failure, never downgrade.
- The scope is global because the client is installed machine-wide. It runs once per machine or account through `/arcanum-migrate`, not once per repo.
- It also covers existing installs that update before the new client step reaches them, such as the `git clone` first-update gap.
- It reverses the current rule in [Install & Release Pipeline](../architecture/install-and-release.md) ("No per-repo migration installs it or nudges the user to"). That doc changes with the migration, not with this spec.
- The migration is `next/001`; see [update.md](cli-install/update.md#global-migration-next001). Until #872 creates the file, docs cite it as `next/001`, without the `repos/` prefix, because `scripts/bump-version.sh` aborts on a `repos/next/NNN` reference with no matching file. #872 then switches them to the full path, following [Per-Repo Migrations](../architecture/per-repo-migrations.md)' "Referencing pending migrations" rule.

## Parts

| Part | Covers |
| --- | --- |
| [install.md](cli-install/install.md) | The installer (`arcanum/install/`) installing `arcanum-cli@<version>`. |
| [update.md](cli-install/update.md) | The updater (`arcanum/update/`), the `/arcanum-update` skill, `git clone` installs and the global migration. |
| [already-installed.md](cli-install/already-installed.md) | Double installation: detecting the installed client with `npm ls`, updating an older one, leaving a newer or linked (`npm link`) one, skipping an unreadable one, and warning about a foreign `arcanum` on `PATH`. |
| [self-update.md](cli-install/self-update.md) | The `arcanum self-update` CLI command. |

## Alternatives considered

- **Pinning to `@latest`** instead of the arcanum version. Rejected: it breaks the lockstep the CLI's version-skew check relies on, and ignores `ARCANUM_VERSION` pins.
- **Always installing the client, with no opt-out.** Rejected: the client needs Node and a writable npm global prefix, which not every user has or wants.
- **Opt-out by env var only, with no prompt.** Rejected: a global `npm i -g` is a machine-wide change, so the user is asked.
- **`ARCANUM_ASSUME_YES` answering the client prompt.** Rejected: that flag only covers the arcanum confirmation; a machine-wide npm install needs its own consent or `ARCANUM_SKIP_CLI`.
- **Failing the arcanum install or update when the client step fails.** Rejected: the client is optional, so its failure must not block arcanum.
- **Accepting that an older `/arcanum-update` skill misreads exit `4`.** Rejected in favor of the opt-in flag, so an old skill never reports a successful update as failed.

## Open points

- The exact wording of the client prompt and of each warning.

## See also

- [Install & Release Pipeline](../architecture/install-and-release.md): how arcanum and `arcanum-cli` are installed and released today.
- [Arcanum CLI](../architecture/arcanum-cli.md): the CLI's architecture, including its version-skew check.
- [Per-Repo Migrations](../architecture/per-repo-migrations.md): how `global`-scoped migrations work.
- [Arcanum CLI guide](../../guides/arcanum-cli.md): the end-user guide for the CLI.
