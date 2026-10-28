# CLI Install

Installing or updating arcanum also offers to install or update the `arcanum-cli` npm package (the [Arcanum CLI](arcanum-cli.md)), pinned to the arcanum version being installed: `arcanum-cli@<arcanum version>`. The client is optional. It is installed with `npm i -g`, behind its own consent, and its failure never fails arcanum.

One shared script, `arcanum/_lib/install_cli.sh`, implements this client step. The installer, the zip updater, the `git clone` update path, `/arcanum-update` and the global migration all call it, and differ only in how consent arrives (see [Callers](#callers)).

Out of scope:

- Installing Node.js or npm when they are missing.
- Uninstalling the client.
- The installer's own behavior on an existing arcanum install: it keeps refusing and pointing to `update`.

The CLI's own updater, `arcanum self-update`, follows the same rules with a few overrides (see [Shared rules](#shared-rules)). Its design lives in [Arcanum CLI → `self-update`](arcanum-cli.md#self-update).

## Shared rules

These rules govern every caller of the client step: the installer, the updater and the migration.

- **Prompt.** After the arcanum confirmation, a separate prompt asks whether to install or update the client. It names the target (`arcanum-cli@<version>`, via `npm i -g`), defaults to yes (`[Y/n]`), and reads from `/dev/tty`.
- **`ARCANUM_SKIP_CLI`**: any non-empty value (docs show `ARCANUM_SKIP_CLI=1`) skips the client step without asking and without calling `node` or `npm`.
- **`ARCANUM_ASSUME_YES=1`** does **not** answer the client prompt. It only skips the main arcanum confirmation. The shared script never reads it.
- **Opt-in `FALLBACK=chat`.** Inside `/arcanum-update` there is no `/dev/tty`. The client step exits `4` with `FALLBACK=chat` (and `CLI_VERSION=<v>`) only when the caller opts in with `ARCANUM_CLI_PROMPT=chat`, which only `/arcanum-update` sets. Any other value, or unset, keeps the no-TTY skip. The flag only asks; it never consents. The skill then asks the same question with `AskUserQuestion`, following the project's TTY-first convention.
- **No-TTY skip.** With no TTY, no `ARCANUM_SKIP_CLI`, no `--no-confirm` and no opt-in flag, the client step is skipped with a warning naming the manual command. It never hangs and never fails the arcanum install or update.
- **Warn and continue.** Any client failure warns with the reason and the manual command, and never fails arcanum: the arcanum install or update still exits `0`. This covers:
  - Node or npm missing;
  - Node below the CLI's floor (22.13.0);
  - `npm i -g` failing, for example EACCES on a global prefix that needs `sudo`, or a network error.

  The step never retries with `sudo`.

- **Validated version.** The shared script validates `VERSION` as a plain semver (`MAJOR.MINOR.PATCH[-prerelease]`) before any `npm` call. Anything else is a warning and a skip, never an `npm` call. `VERSION` comes from `ARCANUM_VERSION` or a GitHub `tag_name`, and on `/arcanum-update` it travels through `CLI_VERSION=` and back as an argument.
- **Exact pin, one argument, no install scripts.** The install is always `npm i -g --ignore-scripts arcanum-cli@<v>`, with `arcanum-cli@<v>` passed as one quoted argument. It is never a range or a dist-tag, so the version installed is the version named in the prompt. `arcanum-cli` has no dependencies and no install-time scripts, so `--ignore-scripts` loses nothing, and a compromised publish cannot run code at install time.
- **Consent only by argument.** The pre-answer that skips the `[Y/n]` prompt is the shared script's `--no-confirm` argument, used only by the `/arcanum-update` resume and the migration. It is never an env var, so an exported variable cannot silently consent to a machine-wide install. `ARCANUM_SKIP_CLI` can only *skip*. `--no-confirm` only answers the prompt and never bypasses the installed-version check: it never downgrades, leaves a linked dev checkout alone, and skips an unreadable install (see [An already-installed client](#an-already-installed-client)).
- **Bounded `npm view`.** `npm view` runs with `--fetch-retries=0` and a bounded `--fetch-timeout` (15 seconds), so an offline machine warns quickly instead of stalling. A timeout means "network error, warn and skip". `npm i -g` keeps npm's defaults: the user has consented and is waiting for it.
- **npm config honored.** The user's npm config (registry, proxy, prefix) is used as is. The step passes no registry override.
- **Forks.** The package name is always `arcanum-cli` on the user's configured npm registry, whatever `ARCANUM_REPO` is. A fork whose tag matches an official version gets the official client of that version. This is documented, not special-cased.
- **Skipped paths cost nothing.** `ARCANUM_SKIP_CLI`, a no-TTY run without the flag, `Already on <v>` and a git checkout without the script make no `npm` call. Otherwise the local installed-version check (`npm ls`) runs first, so an unchanged, newer or linked client costs one local `npm ls` and no network call. Only an install or update that would actually happen adds one `npm view` before asking, plus `npm i -g` after consent.

**What [`arcanum self-update`](arcanum-cli.md#self-update) overrides.** It is an explicit command, not a side effect of installing arcanum, so:

- it ignores `ARCANUM_SKIP_CLI`;
- it has no prompt, so `ARCANUM_ASSUME_YES`, `--no-confirm`, `ARCANUM_CLI_PROMPT`, `FALLBACK=chat` and the no-TTY skip do not apply;
- it fails instead of warning: its npm failures are errors, not warn-and-continue;
- it targets `latest` instead of the arcanum version (see [Version pinning](#version-pinning)).

The exact pin with `--ignore-scripts`, the validated version, the bounded `npm view`, the honored npm config and the fixed `arcanum-cli` package name all still apply.

## Version pinning

- The installer and updater install `arcanum-cli@<the arcanum version being installed>`, not `@latest`. This keeps the [version lockstep](install-and-release.md#version-lockstep) the CLI's version-skew check relies on, and honors `ARCANUM_VERSION` pins.
- If that version is not on npm, the client is left untouched, with a warning naming the manual `npm i -g arcanum-cli` command. Examples: a fork's own version, or an arcanum release older than the first CLI publish. The arcanum install or update still succeeds.
- `arcanum self-update` targets `latest` instead: it resolves `latest` with a bounded `npm view` and installs that exact version. See [Arcanum CLI → `self-update`](arcanum-cli.md#self-update).

## The shared script

`arcanum/_lib/install_cli.sh` is the only implementation of the client step. No caller has code of its own.

```text
install_cli.sh <version> [--no-confirm]
```

- **`<version>`**: the target `arcanum-cli` version, a plain semver, validated before any `npm` call.
- **`--no-confirm`**: pre-answers the `[Y/n]` prompt. With it, the script never opens `/dev/tty`. It never bypasses detection.

**Environment.**

| Variable | Meaning |
| --- | --- |
| `ARCANUM_SKIP_CLI` | Any non-empty value skips the step, with no `node` or `npm` call. |
| `ARCANUM_CLI_PROMPT` | Exactly `chat`: with no TTY, exit `4` instead of the no-TTY skip. Any other value, or unset, keeps the skip. Only asks, never consents. It must be an env var, because it has to cross `bootstrap.sh` → `exec updater.sh`. |
| `ARCANUM_TTY_DEVICE` | Test-only: overrides the TTY device (default `/dev/tty`). `installer.sh` shares the same seam. |
| `ARCANUM_CLI_TIMEOUT_MS` | Test-only: overrides the `npm ls` / `npm view` timeout (default `15000`). |

`ARCANUM_ASSUME_YES` is never read.

**Output.** Every user-facing line goes to stderr, prefixed `arcanum-cli:`: info lines are `arcanum-cli: <message>`, warnings are `arcanum-cli: warning: <reason>. Install it manually with: <command>`. npm's own `npm i -g` output is forwarded to stderr too. stdout is empty, except on exit `4`.

**Exit codes.**

| Code | Meaning |
| --- | --- |
| `0` | Every outcome: installed, updated, unchanged, skipped, declined, or failed with a warning. |
| `1` | Usage error: missing or extra arguments, or an unknown flag. |
| `4` | Opt-in chat fallback: no TTY, `ARCANUM_CLI_PROMPT=chat`, and an install or update would happen. stdout carries `FALLBACK=chat`, `CLI_VERSION=<v>`, and `CLI_INSTALLED=<v>` when a client is already installed (an older one). |

**Order of checks.**

1. `ARCANUM_SKIP_CLI` set: skip.
2. `VERSION` not a plain semver: warn and skip.
3. No TTY, no `--no-confirm` and no `ARCANUM_CLI_PROMPT=chat`: skip with a warning. The TTY is only probed when it is needed: with `--no-confirm` the script never opens `/dev/tty`, and with `ARCANUM_CLI_PROMPT=chat` a missing TTY becomes the exit `4` at step 7.
4. `node` and `npm` present and Node at least 22.13.0, else warn and skip.
5. **Detect** with `npm ls -g --json --depth=0 arcanum-cli` (local); see [An already-installed client](#an-already-installed-client):
   - `unknown`: warn and skip;
   - `same`: info "already up to date", done;
   - `newer`: info with the downgrade command, done;
   - `linked`: info, done;
   - `older` or `missing`: continue.
6. `npm view arcanum-cli@<version> version`, bounded: `E404` or empty output means unpublished, any other failure is a network error; both warn and skip.
7. Prompt on the TTY: `Install arcanum-cli@<version> globally (npm i -g)? [Y/n]` for a `missing` client, `Update arcanum-cli <old> → <version> (npm i -g)? [Y/n]` for an `older` one. Enter means yes. `--no-confirm` skips it. With no TTY and `ARCANUM_CLI_PROMPT=chat`, this is where the script exits `4`.
8. `npm i -g --ignore-scripts arcanum-cli@<version>`. Never `sudo`, never `--force`, never a retry.
9. `PATH` check (see [Foreign `arcanum` on `PATH`](#foreign-arcanum-on-path)).

Checks that need no user input run first, so the prompt is only asked when the install can actually happen. Detection before `npm view` means only an install that would actually happen touches the network. Detection still runs after the TTY check, so the no-TTY skip makes no `npm` call.

**Why plain bash.** The client step runs from `installer.sh` and `bootstrap.sh` outside any configured repo, must use the host's `npm`, and must work (by warning and skipping) when Node is missing. It is therefore deliberately plain bash outside engine dispatch: no `engine_dispatch` shim, no native twin in `core/`, no `migration-status.json` entry. [Script Engine](script-engine.md) records the exception. The installed-version detection and the semver comparison run inside a small `node -e` wrapper, since Node is already confirmed at that point (no `jq`, no `semver` dependency).

## An already-installed client

What the client step does when `arcanum-cli` is already installed globally (double installation), for every caller alike.

### Installed version

- **Older than the target:** the client is updated in place to `arcanum-cli@<target version>`. It never fails and never produces a duplicate install.
- **Same version as the target:** no-op, with a note that the client is already up to date.
- **Newer than the target** (for example after `arcanum self-update` moved it to `@latest`): left as is, with a note on how to downgrade manually. A newer CLI only sees the config tiers as "behind", which is the safe direction.

### Detection

- **Single source.** The installed client is detected with `npm ls -g --json --depth=0 arcanum-cli`. It asks the same `npm` and global prefix that `npm i -g` installs into, so with nvm or several Node installs, detection and install always target the same client. It needs no network, and `--depth=0` keeps it fast.
- **JSON, never the exit code.** `npm ls` exits `1` both when the package is missing and on some tree problems. The `node -e` wrapper parses its stdout:
  - `.dependencies["arcanum-cli"].version` present: **installed** at that version.
  - Valid JSON with no `arcanum-cli` entry (for example `{"name":"lib"}`): **not installed** (`missing`).
  - No output, invalid JSON, or an entry without `version`: **unknown**.
- **Bounded.** The wrapper runs `npm ls` with `spawnSync(..., { timeout })` (15 seconds), because macOS has no portable `timeout`. A timeout counts as **unknown**.
- **Unknown: warn and skip.** A warning names the reason and the manual command (`npm i -g arcanum-cli@<version>`). There is no `npm i -g` call, and the step exits `0`. This keeps never-downgrade absolute: a client whose version cannot be read might be newer than the target.
- **`arcanum --version` is not used.** It may resolve to another prefix's binary or a foreign `arcanum` on `PATH`, or to a CLI too old to support the flag. It does not identify the npm-managed package the install would replace.

The wrapper prints `CLI_STATE=<state>` (`missing`, `older`, `same`, `newer`, `linked` or `unknown`) and, when known, `CLI_INSTALLED=<v>`. Both are internal to the shared script, except that `CLI_INSTALLED` is also the stdout key on exit `4`. The bash side is a plain `case`.

### Version comparison

- **Semver precedence.** `MAJOR.MINOR.PATCH` compare numerically. On a tie, a version with a prerelease is lower than one without (`2.3.0-rc.1` < `2.3.0`). Prereleases compare identifier by identifier: numeric identifiers numerically, others in ASCII order, numeric before alphanumeric. Build metadata (`+…`) is ignored.
- **Unparseable installed version:** `unknown`, so warn and skip. The target is already validated as plain semver before this step.
- **Prerelease target, release installed** (target `2.3.0-rc.1`, installed `2.3.0`): `newer`, so left as is, with a note.

### Linked dev checkout

- A client installed with `npm link` from `cli/` (an entry with `link: true` or `resolved: "file:…"`) is **`linked`**, whatever its version.
- It is left as is, with an info line naming the link target. No prompt, no `npm view`, no `npm i -g`. Replacing it would turn a contributor's symlink into a published copy and silently break their dev setup.

### Foreign `arcanum` on `PATH`

- **Warn only.** A foreign binary never blocks or changes what is installed. Detection stays on `npm ls`, so it never affects the older/same/newer decision. The foreign binary is never run, removed or inspected.
- **When.** After the client step, only when the step ends with `arcanum-cli` present: installed, updated, unchanged or newer kept. Skipped, declined, linked, unknown and failed paths make no extra call.
- **How.** Compare the resolved directory of `command -v arcanum` with `$(npm prefix -g)/bin`. Both are resolved with `cd -P … && pwd -P`, so symlinked `PATH` entries do not raise a false alarm. Both calls are local. Arcanum's scripts are bash-only, so the Windows prefix layout (no `bin/`) does not apply.

| Case | Outcome |
| --- | --- |
| `arcanum` resolves into the npm global `bin` | Nothing extra. |
| `arcanum` resolves elsewhere (another nvm version's client, a Homebrew or hand-built binary, an unrelated tool) | Warning: `arcanum` on `PATH` is `<path>`, not the client at `<prefix>/bin/arcanum`, with a hint to reorder `PATH` or remove the other one. |
| `arcanum` not on `PATH` | Warning: the client is at `<prefix>/bin/arcanum`, but `<prefix>/bin` is not on `PATH`. |

- **Another npm package owns `<prefix>/bin/arcanum`.** `npm i -g` fails with `EEXIST`. That is the EEXIST row of the [install outcomes](#install-outcomes): a warning with the reason and the manual command, exit `0`. `--force` is never passed.

### Per-caller behavior

- **`--no-confirm` only answers the prompt.** It never bypasses detection: it never downgrades, leaves `linked` alone, and skips `unknown`.
- **The resume re-detects.** `run_update.sh install-cli <v>` runs the full flow with `--no-confirm`, so a state change between the question and the answer (for example a `self-update` meanwhile) is handled. The cost is one more local `npm ls`.
- **`/arcanum-update`.** With `ARCANUM_CLI_PROMPT=chat` and no TTY, the prompt step is where the script exits `4`. Same, newer, linked and unknown end with exit `0` before that, with no question in chat. The `AskUserQuestion` uses the same update wording, which is why exit `4` also carries `CLI_INSTALLED=<v>`.
- **Installer.** An already-installed client is rare on a fresh arcanum install, but possible (a client from an earlier arcanum, or installed by hand). Nothing is special-cased.

| Caller | Consent | `older` client | `same` / `newer` / `linked` / `unknown` |
| --- | --- | --- | --- |
| Installer (`installer.sh`) | TTY prompt | Update prompt, `current → target` | Info or warning, exit `0` |
| Updater, zip (`updater.sh`) | TTY prompt | Same | Same |
| Updater, git (`bootstrap.sh`, running the script from the checked-out tree) | TTY prompt | Same | Same |
| `/arcanum-update` (`ARCANUM_CLI_PROMPT=chat`, no TTY) | Exit `4` with `FALLBACK=chat`, `CLI_VERSION`, `CLI_INSTALLED`, then `AskUserQuestion`, then `install-cli <v>` with `--no-confirm` | The skill asks `current → target` | Exit `0`, no chat question; the line reaches the user through inherited stdio |
| Migration `arcanum/migrations/repos/2.3.0/001.sh` (`--no-confirm`; `[R]un` is the consent) | None | Updated directly | Same rules: never downgrade, `linked` left alone, `unknown` skipped |

### Edge cases

| Case | Outcome |
| --- | --- |
| Half-installed package (`npm ls` entry without `version`, or `missing: true`) | `unknown`: warn and skip. |
| Entry flagged `invalid` or `extraneous`, with a readable `version` | The version is trusted; normal flow. `npm ls` exits `1` here, hence JSON parsing. |
| `npm ls` hangs | The ~15 s timeout fires: `unknown`, warn and skip. |
| Client installed under another prefix (another nvm Node) | Not seen: `missing`, so it is installed into the active prefix. The `PATH` check warns if the other copy comes first. |
| Node switched since the last update | Same as above: detection always follows the active `npm`. |
| `npm i -g` fails midway | Update failed: warning. npm keeps or restores the old client. No retry. |
| Linked dev checkout (`npm link` from `cli/`: entry with `link: true` or `resolved: "file:…"`) | `linked`: info, left as is, whatever its version. No prompt, no `npm view`, no `npm i -g`. |
| `--no-confirm` with a newer client | `newer`: left as is. `--no-confirm` never forces a downgrade. |

## Callers

### Installer (`arcanum/install/installer.sh`)

- **Placement.** The client step is the last step of `installer.sh`. It runs after the target-directory prompt, after the copy and the `arcanum.json` write, and after the `arcanum installed to <target>` line. A client failure therefore never leaves arcanum half-installed.
- **Two separate confirmations.** The arcanum `[y/N]` trust prompt stays in `arcanum/install/bootstrap.sh`, and `ARCANUM_ASSUME_YES` skips it. The client `[Y/n]` prompt is asked from `installer.sh` through the shared script, and `ARCANUM_ASSUME_YES` does not answer it.
- **Target.** `arcanum-cli@$VERSION`, using the `VERSION` that `bootstrap.sh` exports (`ARCANUM_VERSION`, or its default).
- **Exit code.** The install exits `0` whatever the client outcome. The call is guarded with `|| true`, so even a usage error of the shared script cannot fail the install.
- **No chat fallback.** The installer clears `ARCANUM_CLI_PROMPT` for the call, since it has no chat to fall back to. An exported `ARCANUM_CLI_PROMPT=chat` therefore never makes it exit `4` or print `FALLBACK=chat`.
- **Earlier steps unchanged.** Aborting the target confirmation or hitting an existing arcanum install still exits `1`, before the client step runs. The no-TTY skip is rarely reached here: the target-directory prompt already reads `/dev/tty`, so a run with no TTY fails there first.
- **Git clone.** Running `installer.sh` directly from a git clone still needs `REPO` and `VERSION` set in the environment. The client step adds no requirement.

### Zip updater (`arcanum/update/updater.sh`)

- **Placement.** The client step is the last step of `updater.sh`. It runs after the copy, the delete set, the `arcanum.json` write and the `arcanum updated to <v> at <target>` line, and before `cleanup` removes the release tree. A client failure therefore never leaves the arcanum update half-done or blocks a retry.
- **From the installed tree.** It calls `$TARGET/arcanum/_lib/install_cli.sh`, so the script outlives `cleanup`. The old local `bootstrap.sh` execs the *new* `updater.sh`, so this works from the first update after the release.
- **Target.** `arcanum-cli@$VERSION`, the version being installed.
- **Already on the version.** On `Already on <v>.` (exit `0`), the client step is **not** run. A no-op update stays a no-op and asks nothing. The [global migration](#global-migration) and `arcanum self-update` cover a client that was skipped earlier.
- **Exit code.** It propagates an exit `4` and ignores any other client exit.

### `git clone` path (`arcanum/update/bootstrap.sh`)

- **From the checked-out tree.** After `git checkout <version>` and the `arcanum updated to ...` line, `bootstrap.sh` calls `$TARGET/arcanum/_lib/install_cli.sh` from the checked-out tree, so every later update runs the new copy.
- **Inside the git `if` block.** The call stays inside `bootstrap.sh`'s `if [[ "$METHOD" == "git" ]]; then ... fi` block, before its `exit`. `git checkout` rewrites the running `bootstrap.sh` on disk, and bash has already parsed that whole compound command; a top-level command after the block would be read from the new file at an arbitrary offset.
- **Old checkout.** If the checked-out tree has no such script (an `ARCANUM_VERSION` pin older than the feature), the step is skipped silently.
- **Already on the version.** `Already on <v>.` stays a no-op, as in the zip path.
- **Exit code.** It propagates an exit `4` and ignores any other client exit.

### `/arcanum-update`

- **Opt-in.** `run_update_apply` sets `ARCANUM_CLI_PROMPT=chat` next to `ARCANUM_ASSUME_YES=1` when it runs `bootstrap.sh`, in both its shell implementation (`run_update_apply_shell.sh`) and the native `ArcanumUpdateRunUpdate.js`.
- **Exit `4`.** With the flag and no TTY, the shared script runs its non-interactive checks first. Only if an install or update would actually happen does it print `FALLBACK=chat`, `CLI_VERSION=<v>` and, when a client is already installed, `CLI_INSTALLED=<v>`, and exit `4`. Because the client step is last, the arcanum update is already complete at that point.
- **Propagation.** `updater.sh` and the git path of `bootstrap.sh` propagate that exit `4`. `bootstrap.sh` runs with inherited stdout, so the lines reach the skill directly. On exit `4`, `run_update_apply` still prints its normal `RESULT=updated FROM=<old> TO=<new>` line after them, and exits `4`.
- **Resume.** The skill reports the update as successful, then asks once with `AskUserQuestion` (Yes, No, Chat), worded as an update naming both versions when `CLI_INSTALLED` is set.
  - **Yes:** `scripts/run_update.sh install-cli <CLI_VERSION>` runs the shared script with `--no-confirm`, under the same warn-and-continue rules. It re-detects the installed client first, so it never downgrades. `install-cli` is a plain case branch of `run_update.sh` that calls the shared script directly; it is not a migrated entrypoint (no `engine_dispatch`, no `_shell.sh` twin, no native command), because, like the shared script, it must run on the host with the host's `npm`. A wrong argument count prints usage and exits `1`.
  - **No:** the skill prints the manual command (`npm i -g arcanum-cli@<v>`).
  - **Chat:** the skill returns to the conversation.
- **Other exits.** Any other non-zero exit keeps its meaning: the arcanum update failed.
- **TTY.** When a TTY is available (rare inside Claude Code), the shared script asks on `/dev/tty`, as everywhere else.

### Global migration

- **Entry.** `arcanum/migrations/repos/2.3.0/001.sh`, with the manifest entry `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "global"}` and the summary `arcanum/migrations/repos/2.3.0/001.md`. Docs cite it by that full path, following [Per-Repo Migrations](per-repo-migrations.md)' "Referencing pending migrations" rule, so `scripts/bump-version.sh` rewrites it on release.
- **Scope.** Global, because the client is installed machine-wide: it runs once per machine or account through `/arcanum-migrate`, not once per repo. It also covers installs that update before the client step reaches them, such as the `git clone` first-update gap.
- **Paths.** They come from the script's own location, never from the cwd: the install root is four levels up, and the shared script is `arcanum/_lib/install_cli.sh` under it.
- **Target version.** The installed arcanum version: `arcanum.json`'s `.version`, or else `git describe --tags --exact-match` for a git clone, passed as is (the shared script validates semver itself). If neither resolves (a clone on a branch or an untagged commit), the migration warns, naming `npm i -g arcanum-cli`, and exits `0` without calling the shared script.
- **Consent.** Choosing `[R]un` (or All in the fallback) at the migration prompt is the consent. The migration calls the shared script with `--no-confirm`, the same pre-answer as the `/arcanum-update` resume, so there is no second `[Y/n]`. Users who don't want the client pick `[S]kip`.
- **Exit code.** It always exits `0` (warn and continue), even when the shared script exits non-zero, so the global pointer advances even if the client could not be installed. The shared script's stderr is folded into the migration's stdout (`2>&1`), because the migration runner only shows a migration's stderr when it fails.
- **Never downgrade.** `--no-confirm` keeps the [already-installed](#an-already-installed-client) rules: never a downgrade, a linked client left alone, an unreadable one skipped.

## Outcomes

The wording below is the source of truth for the client step's messages, and the tests assert it.

### Install outcomes

Every outcome exits `0`. Each outcome prints one line on stderr, prefixed `arcanum-cli:`: info lines are `arcanum-cli: <message>`, warnings are `arcanum-cli: warning: <reason>. Install it manually with: npm i -g arcanum-cli@<version>`. stdout stays empty. The only other exits are `1` for a usage error and the opt-in exit `4` of [`/arcanum-update`](#arcanum-update).

| Case | Condition | Output | Exit |
| --- | --- | --- | --- |
| Installed | The user accepts (`Install arcanum-cli@<version> globally (npm i -g)? [Y/n]`) and `npm i -g` succeeds. | `arcanum-cli: arcanum-cli@<version> installed.` | `0` |
| Skipped by env | `ARCANUM_SKIP_CLI` is set (any non-empty value). | `arcanum-cli: client step skipped (ARCANUM_SKIP_CLI is set)` | `0` |
| Invalid version | `VERSION` is not a plain semver. | `arcanum-cli: warning: '<version>' is not a plain semver version, client step skipped. Install it manually with: npm i -g arcanum-cli`. No `npm` call. | `0` |
| Skipped, no TTY | No `/dev/tty`, no `--no-confirm` and no `ARCANUM_CLI_PROMPT=chat`. | `arcanum-cli: warning: no TTY to ask for consent, client step skipped. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| Declined | The user answers no (or the TTY closes before an answer). | `arcanum-cli: skipped by user. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| No Node or npm | `node` or `npm` is not on `PATH`. | `arcanum-cli: warning: node or npm is not on PATH, client step skipped. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| Node too old | Node is below 22.13.0. | `arcanum-cli: warning: Node <found> found, 22.13.0 or later required, client step skipped. Install it manually with: npm i -g arcanum-cli@<version>` | `0` |
| Unpublished version | `npm view` reports `E404`, or prints nothing. | `arcanum-cli: warning: arcanum-cli@<version> is not published on npm, client step skipped. Install it manually with: npm i -g arcanum-cli` | `0` |
| EACCES | `npm i -g` fails with `EACCES`. | `arcanum-cli: warning: npm i -g failed with EACCES (no write access to the npm global prefix); fix the prefix (npm config set prefix) or run the command with the right permissions. Install it manually with: npm i -g arcanum-cli@<version>`. No `sudo` retry. | `0` |
| EEXIST | `npm i -g` fails with `EEXIST`. | `arcanum-cli: warning: npm i -g failed with EEXIST (another package owns the arcanum binary). Install it manually with: npm i -g arcanum-cli@<version>`. No `--force`. | `0` |
| Network error | `npm view` fails for any reason other than `E404`, or `npm i -g` fails for any other reason. | `npm view`: `arcanum-cli: warning: could not reach the npm registry (network error[: <code>]), client step skipped. Install it manually with: npm i -g arcanum-cli@<version>`. `npm i -g`: `arcanum-cli: warning: npm i -g failed (<code or exit status>). Install it manually with: npm i -g arcanum-cli@<version>`. | `0` |
| Client already installed | `arcanum-cli` is already installed globally. | Updated, unchanged, newer kept, linked or unknown: see the [already-installed outcomes](#already-installed-outcomes). | `0` |

### Already-installed outcomes

Every case exits `0` and prints one line on stderr, following the [install outcomes](#install-outcomes) convention (`arcanum-cli:` prefix, warnings ending with the manual command). `<v>` is the target version.

| Case | Condition | Output | Exit |
| --- | --- | --- | --- |
| Updated | `older`; the user accepts (`Update arcanum-cli <old> → <v> (npm i -g)? [Y/n]`); `npm i -g` succeeds. | `arcanum-cli: arcanum-cli updated <old> → <v>.` | `0` |
| Unchanged | `same`. | `arcanum-cli: arcanum-cli@<v> is already up to date.` No prompt, no `npm view`. | `0` |
| Newer kept | `newer`. | `arcanum-cli: arcanum-cli@<installed> is newer than <v>; left as is. Downgrade with: npm i -g --ignore-scripts arcanum-cli@<v>` (info, not a warning). No prompt, no `npm view`. | `0` |
| Linked | `linked`. | `arcanum-cli: arcanum-cli is linked from <path>; left as is.` (`arcanum-cli is linked (npm link); left as is.` when npm reports no `file:` path). No prompt, no `npm view`, no `npm i -g`. | `0` |
| Unknown | `npm ls` timed out, failed, or gave no readable version. | `arcanum-cli: warning: could not read the installed arcanum-cli version (<reason>), client step skipped. Install it manually with: npm i -g arcanum-cli@<v>`. No `npm i -g`. | `0` |
| Declined (update) | `older`; the user answers no. | `arcanum-cli: skipped by user. Install it manually with: npm i -g arcanum-cli@<v>` | `0` |
| Update failed | `npm i -g` fails (`EACCES`, `EEXIST`, network). | The matching warning rows of the [install outcomes](#install-outcomes), unchanged. The old client stays in place. | `0` |
| `PATH` warning | See [Foreign `arcanum` on `PATH`](#foreign-arcanum-on-path). | One extra line after the outcome line: `arcanum-cli: warning: arcanum on PATH is <path>, not the client at <prefix>/bin/arcanum; reorder PATH or remove the other one.` or `arcanum-cli: warning: the client is at <prefix>/bin/arcanum, but <prefix>/bin is not on PATH.` | `0` |

"Newer kept" is info because it is the expected state after `arcanum self-update`.

### Update outcomes

| Case | Outcome | Exit |
| --- | --- | --- |
| Update applied, client step installs, updates, skips or warns | As in the [install outcomes](#install-outcomes) | `0` |
| Already on the version | No client step | `0` |
| `/arcanum-update`, no TTY, flag set, install would happen | `FALLBACK=chat`, `CLI_VERSION=<v>`, `CLI_INSTALLED=<v>` (only when a client is installed), then `RESULT=...` from `run_update_apply` | `4` |
| `/arcanum-update`, no TTY, flag set, nothing to do (unchanged, newer, linked or unreadable client, unpublished, no Node...) | Note or warning, no question | `0` |
| `/arcanum-update` resume, Yes | `install-cli` runs the client step with `--no-confirm`, per the [install outcomes](#install-outcomes) | `0` |
| Old skill (no flag), no TTY | No-TTY skip with a warning | `0` |
| Git path, checked-out tree has no client-step script | Skipped silently | `0` |
| Migration skipped | Nothing runs; the pointer advances | `0` |
| Migration, version unresolvable | Warning with the manual command | `0` |
| Migration run, client step installs, updates or warns | As in the [install outcomes](#install-outcomes); never a downgrade | `0` |

## Backward compatibility

The client step only adds behavior. No config shape changes, and existing installs keep working. The risk is in which copy of the scripts runs during the first update after the client step shipped.

- **Zip-tracked installs.** The old local `arcanum/update/bootstrap.sh` downloads the new release and execs the *new* `updater.sh`, so the client step runs on the first update. No special handling is needed.
- **`git clone` installs.** `bootstrap.sh` updates directly with `git fetch`/`git checkout` and never runs `updater.sh`. It calls the shared script *from the checked-out tree* after the checkout, so every later update runs the new copy. The first update after the release still runs the old `bootstrap.sh`, which has no client step. The global migration and the README point those users to `npm i -g arcanum-cli` once.
- **An older `/arcanum-update` session** does not know exit `4` / `FALLBACK=chat`. Because the client step only exits `4` when the caller opts in, an old skill gets the no-TTY behavior instead: the client is skipped with a warning and the update exits `0`. An old skill therefore never reports a successful arcanum update as failed.

## Testing

The standalone shell tests below run by hand (`bash <file>`); wiring them into CI is #882.

- **`arcanum/_lib/test_install_cli.sh`** covers the shared script itself, with stub `node` and `npm` executables first on `PATH`: one test per outcome row, the `npm ls` states (missing, older, same, newer, prerelease target with the release installed, linked, an entry without `version`, invalid JSON, an `invalid`-flagged entry, a timeout), the semver comparison, `--no-confirm` with a newer client, the `PATH` check, and that the skipped paths make no `npm` call. It also fails if the Node floor drifts from `cli/package.json`'s `engines.node`.
- **`arcanum/install/test_installer.sh`** runs the real `installer.sh` from a fake release tree: the client step runs after `arcanum.json` is written, `ARCANUM_SKIP_CLI=1` makes no `node`/`npm` call, a client failure still exits `0`, `ARCANUM_ASSUME_YES` does not answer the client prompt, an exported `ARCANUM_CLI_PROMPT=chat` never yields exit `4`, and an existing install or an aborted confirmation still exits `1` with no client call.
- **`arcanum/update/test_updater.sh`** (zip path) and **`arcanum/update/test_update_bootstrap.sh`** (git path) replace the shared script with a recording stub: it is called last, from `$TARGET`, with `$VERSION`; not called on `Already on <v>.`; skipped silently when missing on the git path; exit `4` propagates with its stdout lines; a usage-error exit `1` is ignored; and `ARCANUM_CLI_PROMPT` reaches it unchanged.
- **`arcanum-update/scripts/test_run_update_install_cli.sh`** covers `run_update.sh install-cli`: the call (`<version> --no-confirm`, from the install's `arcanum/_lib/`), exit-code pass-through and usage errors.
- **`run_update_apply`**: the shell/native parity spec (`core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js`) and the native unit spec (`core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js`) check that the flag is set and that the `FALLBACK=chat` / `CLI_VERSION=` lines and the `RESULT=` line are printed on exit `4`.
- **The migration**: `core/spec/bin/migrationsCliInstall_spec.js` runs the real `arcanum/migrations/repos/2.3.0/001.sh` against a stub shared script: `config`, the version from `arcanum.json` or an exact tag, the untagged-commit warning, the `<version> --no-confirm` call, and exit `0` on a stub failure.
- **`/arcanum-update`'s exit `4` branch** is reviewed by `skill-reviewer` (TTY-first with an `AskUserQuestion` fallback).

## Alternatives considered

- **Pinning to `@latest`** instead of the arcanum version. Rejected: it breaks the lockstep the CLI's version-skew check relies on, and ignores `ARCANUM_VERSION` pins.
- **Always installing the client, with no opt-out.** Rejected: the client needs Node and a writable npm global prefix, which not every user has or wants.
- **Opt-out by env var only, with no prompt.** Rejected: a global `npm i -g` is a machine-wide change, so the user is asked.
- **`ARCANUM_ASSUME_YES` answering the client prompt.** Rejected: that flag only covers the arcanum confirmation; a machine-wide npm install needs its own consent or `ARCANUM_SKIP_CLI`.
- **An env var as the pre-answer**, or **`--yes` as its name.** Rejected: an exported variable could consent to a machine-wide install without the user seeing a prompt. `--no-confirm` is the name arcanum already uses with the same meaning in the migration runner.
- **Failing the arcanum install or update when the client step fails.** Rejected: the client is optional, so its failure must not block arcanum.
- **Accepting that an older `/arcanum-update` skill misreads exit `4`.** Rejected in favor of the opt-in flag, so an old skill never reports a successful update as failed. The flag is named `ARCANUM_CLI_PROMPT`, not `ARCANUM_CLI_FALLBACK`, because it describes what it changes (how the prompt is asked).
- **Running the client step before the copy, or prompting for it inside `install/bootstrap.sh`.** Rejected: a client failure or a slow `npm` could abort a half-done install, and the bootstrap is piped straight into bash and must stay minimal.
- **Treating every `npm view` failure as "not published", or skipping `npm view` and relying on `npm i -g` failing.** Rejected: it would hide network errors behind a misleading message, or leave a warning unable to name the real reason.
- **Running the client step on `Already on <v>`.** Rejected: every no-op update would ask again, including users who declined. The migration and `self-update` cover the gap.
- **The skill re-running the whole update after the chat answer.** Rejected: the arcanum update has already finished, so re-running it is a no-op that would skip the client step anyway. The `install-cli` subcommand resumes just the client step.
- **A separate client-step script for the git path.** Rejected: the shared script already is that script; a second one would duplicate the rules.
- **A repo-scoped migration, a nudge-only migration, or no migration** (accepting a one-update lag for `git clone` installs). Rejected: the client is machine-wide, so the migration is global; it installs the client, skippable for users who do not want it, so `git clone` users do not silently miss it.
- **A second `[Y/n]` inside the migration.** Rejected: `[R]un` is already explicit consent, and a second prompt would break the migration's no-TTY fallback mode.
- **Letting npm run install scripts.** Rejected: the package needs none, and `--ignore-scripts` removes code execution at install time.
- **Auto-downgrading a client that is newer than the target.** Rejected: it would undo a deliberate `arcanum self-update`, and a newer client is safe against older config tiers.
- **Equality only (update whenever different).** Rejected: it breaks never-downgrade.
- **`arcanum --version` for detection**, or **`npm ls`'s exit code.** Rejected: the first does not identify the npm-managed package the install would replace, and `1` from the second means both "missing" and "problem".
- **Treating unknown as not installed** (prompt and install). Rejected: it could silently downgrade a newer client that `npm ls` failed to report.
- **`sort -V` in bash for the comparison.** Rejected: it orders prereleases after their release, and older macOS BSD `sort` lacks `-V`.
- **Comparing a linked checkout's version and updating it when older.** Rejected: `npm i -g` would replace the symlink and silently break a contributor's dev setup, and a dev checkout's version is often deliberately stale.
- **Running the foreign binary to identify it**, or **refusing to install when a foreign binary exists.** Rejected: the first executes unknown code, and the second blocks a valid install over a binary the step does not touch.
- **`npm i -g --force` on `EEXIST`.** Rejected: it overwrites another package's binary.

## See also

- [Install & Release Pipeline](install-and-release.md): how arcanum and `arcanum-cli` are installed, updated and released.
- [Arcanum CLI](arcanum-cli.md): the CLI's architecture, including its version-skew check and [`self-update`](arcanum-cli.md#self-update).
- [Per-Repo Migrations](per-repo-migrations.md): how `global`-scoped migrations work.
- [Arcanum CLI guide](../../guides/arcanum-cli.md): the end-user guide for the CLI.
- `README.md`'s [Installation](../../../README.md#installation) and [Updating](../../../README.md#updating) sections: the user-facing install and update steps, including the client prompt.
