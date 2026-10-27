# CLI Install: Already Installed

Part of the [CLI Install](../cli-install.md) spec. The shared rules (prompt, `ARCANUM_SKIP_CLI`, opt-in `FALLBACK=chat`, no-TTY skip, warn-and-continue, version validation, `--ignore-scripts`, consent by argument only, bounded `npm view`) and version pinning live in the index and apply here unchanged.

## Purpose

Define what the client step does when `arcanum-cli` is already installed globally (double installation), for the installer, the updater, `/arcanum-update` and the migration alike.

## Decisions

### Installed version

- **Older than the target:** the client is updated in place to `arcanum-cli@<target version>`. It never fails and never produces a duplicate install.
- **Same version as the target:** no-op, with a note that the client is already up to date.
- **Newer than the target** (for example after `arcanum self-update` moved it to `@latest`): left as is, with a note on how to downgrade manually. A newer CLI only sees the config tiers as "behind", which is the safe direction.

### Detection

- **Single source.** The installed client is detected with `npm ls -g --json --depth=0 arcanum-cli`. It asks the same `npm` and global prefix that `npm i -g` installs into, so with nvm or several Node installs, detection and install always target the same client. It needs no network, and `--depth=0` keeps it fast.
- **JSON, never the exit code.** `npm ls` exits `1` both when the package is missing and on some tree problems. The shared script parses its stdout with a `node -e` wrapper (Node is already confirmed by the Node/npm check; no `jq`):
  - `.dependencies["arcanum-cli"].version` present: **installed** at that version.
  - Valid JSON with no `arcanum-cli` entry (for example `{"name":"lib"}`): **not installed**. The plain install flow from [install.md](install.md) runs.
  - No output, invalid JSON, or an entry without `version`: **unknown**.
- **Bounded.** The wrapper runs `npm ls` with `spawnSync(..., { timeout: ~15s })`, because macOS has no portable `timeout`. A timeout counts as **unknown**.
- **Unknown: warn and skip.** A warning names the reason and the manual command (`npm i -g arcanum-cli@<version>`). There is no `npm i -g` call, and the step exits `0`. This keeps never-downgrade absolute: a client whose version cannot be read might be newer than the target.
- **`arcanum --version` is not used.** It may resolve to another prefix's binary or a foreign `arcanum` on `PATH`, or to a CLI too old to support the flag. It does not identify the npm-managed package the install would replace.

### Version comparison

- **Semver precedence.** `MAJOR.MINOR.PATCH` compare numerically. On a tie, a version with a prerelease is lower than one without (`2.3.0-rc.1` < `2.3.0`). Prereleases compare identifier by identifier: numeric identifiers numerically, others in ASCII order, numeric before alphanumeric. Build metadata (`+…`) is ignored.
- **Same wrapper.** The comparison lives in the same `node -e` wrapper that runs and parses `npm ls` (about 15 lines of plain JS, no `semver` dependency). It prints `CLI_STATE=<state>` and, when known, `CLI_INSTALLED=<v>` (see [Names](#names)). The bash side is a plain `case`.
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

- **Another npm package owns `<prefix>/bin/arcanum`.** `npm i -g` fails with `EEXIST`. That is [install.md](install.md#outcomes)'s existing failure row for `npm i -g`: a warning with the reason and the manual command, exit `0`. `--force` is never passed.

### Per-caller behavior

- **One implementation.** All of this lives in the shared client-step script (#868, `arcanum/_lib/install_cli.sh`). No caller has code of its own; callers differ only in how consent arrives (see [Callers](#callers)).
- **`--no-confirm` only answers the prompt.** It never bypasses detection: it never downgrades, leaves `linked` alone, and skips `unknown`.
- **The resume re-detects.** `run_update.sh install-cli <v>` runs the full flow with `--no-confirm`, so a state change between the question and the answer (for example a `self-update` meanwhile) is handled. The cost is one more local `npm ls`.
- **Installer.** An already-installed client is rare on a fresh arcanum install, but possible (a client from an earlier arcanum, or installed by hand). Nothing is special-cased.

## Flow

The client step ([install.md's Flow](install.md#flow) step 5, shared by every caller) runs in this order:

1. `ARCANUM_SKIP_CLI` set: skip.
2. `VERSION` not a plain semver: warn and skip.
3. No TTY, no `--no-confirm` and no `ARCANUM_CLI_PROMPT=chat`: skip with a warning. The TTY is only probed when it is needed: with `--no-confirm` the script never opens `/dev/tty`, and with `ARCANUM_CLI_PROMPT=chat` a missing TTY becomes the exit `4` at step 7.
4. `node` and `npm` present and Node at least 22.13.0, else warn and skip.
5. **Detect** with `npm ls -g --json --depth=0 arcanum-cli` (local):
   - `unknown`: warn and skip;
   - `same`: info "already up to date", done;
   - `newer`: info with the downgrade command, done;
   - `linked`: info, done;
   - `older` or `missing`: continue.
6. `npm view arcanum-cli@<version>`: unpublished or network error, warn and skip.
7. Prompt: for an `older` client, the update prompt naming `current → target`; for a `missing` one, [install.md](install.md)'s install prompt.
8. `npm i -g --ignore-scripts arcanum-cli@<version>`.
9. `PATH` check (see [Foreign `arcanum` on `PATH`](#foreign-arcanum-on-path)).

- **Detection before `npm view`.** Only an install that would actually happen touches the network. Same, newer and linked cost one local `npm ls`: no `npm view`, no prompt.
- **Detection after the TTY check.** Same and newer need neither a TTY nor a prompt, but detection still runs after step 3, so the index's "no TTY, no `npm` call" and [Skipped paths cost nothing](../cli-install.md#shared-rules) rules stay simple.
- **`/arcanum-update`.** With `ARCANUM_CLI_PROMPT=chat` and no TTY, step 7 is where the script exits `4` with `FALLBACK=chat`. Same, newer, linked and unknown end with exit `0` before that, with no question in chat.
- **Prompt wording.** The update prompt uses the same `[Y/n]`, default yes, from `/dev/tty`, worded as an update naming both versions, for example `Update arcanum-cli 2.2.3 → 2.3.0 (npm i -g)? [Y/n]`. The `/arcanum-update` `AskUserQuestion` uses the same wording, which is why exit `4` also carries `CLI_INSTALLED=<v>`. The final wording is in the [Outcomes](#outcomes) table below.

## Outcomes

Every case exits `0` and prints one line on stderr, following [install.md's Outcomes](install.md#outcomes) convention (`arcanum-cli:` prefix, warnings ending with the manual command). `<v>` is the target version.

| Case | Condition | Output | Exit |
| --- | --- | --- | --- |
| Updated | `older`; the user accepts (`Update arcanum-cli <old> → <v> (npm i -g)? [Y/n]`); `npm i -g` succeeds. | `arcanum-cli: arcanum-cli updated <old> → <v>.` | `0` |
| Unchanged | `same`. | `arcanum-cli: arcanum-cli@<v> is already up to date.` No prompt, no `npm view`. | `0` |
| Newer kept | `newer`. | `arcanum-cli: arcanum-cli@<installed> is newer than <v>; left as is. Downgrade with: npm i -g --ignore-scripts arcanum-cli@<v>` (info, not a warning). No prompt, no `npm view`. | `0` |
| Linked | `linked`. | `arcanum-cli: arcanum-cli is linked from <path>; left as is.` (`arcanum-cli is linked (npm link); left as is.` when npm reports no `file:` path). No prompt, no `npm view`, no `npm i -g`. | `0` |
| Unknown | `npm ls` timed out, failed, or gave no readable version. | `arcanum-cli: warning: could not read the installed arcanum-cli version (<reason>), client step skipped. Install it manually with: npm i -g arcanum-cli@<v>`. No `npm i -g`. | `0` |
| Declined (update) | `older`; the user answers no. | `arcanum-cli: skipped by user. Install it manually with: npm i -g arcanum-cli@<v>` | `0` |
| Update failed | `npm i -g` fails (`EACCES`, `EEXIST`, network). | [install.md](install.md#outcomes)'s matching warning rows, unchanged. The old client stays in place. | `0` |
| `PATH` warning | See [Foreign `arcanum` on `PATH`](#foreign-arcanum-on-path). | One extra line after the outcome line: `arcanum-cli: warning: arcanum on PATH is <path>, not the client at <prefix>/bin/arcanum; reorder PATH or remove the other one.` or `arcanum-cli: warning: the client is at <prefix>/bin/arcanum, but <prefix>/bin is not on PATH.` | `0` |

"Newer kept" is info because it is the expected state after `arcanum self-update`.

## Callers

| Caller | Consent | `older` client | `same` / `newer` / `linked` / `unknown` |
| --- | --- | --- | --- |
| Installer (`installer.sh`) | TTY prompt | Update prompt, `current → target` | Info or warning, exit `0` |
| Updater, zip (`updater.sh`) | TTY prompt | Same | Same |
| Updater, git (`bootstrap.sh`, running the script from the checked-out tree) | TTY prompt | Same | Same |
| `/arcanum-update` (`ARCANUM_CLI_PROMPT=chat`, no TTY) | Exit `4` with `FALLBACK=chat`, `CLI_VERSION`, `CLI_INSTALLED`, then `AskUserQuestion`, then `install-cli <v>` with `--no-confirm` | The skill asks `current → target` | Exit `0`, no chat question; the line reaches the user through inherited stdio |
| Migration `arcanum/migrations/repos/next/001.sh` (`--no-confirm`; `[R]un` is the consent) | None | Updated directly | Same rules: never downgrade, `linked` left alone, `unknown` skipped |

## Edge cases

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

## Names

| Name | Kind | Meaning |
| --- | --- | --- |
| `CLI_STATE` | wrapper output | The installed client's state against the target: `missing`, `older`, `same`, `newer`, `linked` or `unknown`. Internal to the shared script. |
| `CLI_INSTALLED=<v>` | wrapper output; stdout key on exit `4` | The installed client's version, printed only when it is known. On the `/arcanum-update` exit `4`, the shared script prints it after `FALLBACK=chat` and `CLI_VERSION=<v>` whenever a client is installed, so the skill can word the question as an update. Additive: an old skill ignores it. See [update.md's Names](update.md#names). |

## Testing strategy

For #868:

- Standalone shell tests (`arcanum/_lib/test_install_cli.sh`, in the style of `arcanum/_lib/test_lock.sh`; running them in CI is #882) with a stub `npm` returning canned `npm ls --json` output: missing, older, same, newer, prerelease target with the release installed, `linked`, an entry without `version`, invalid JSON, an `invalid`-flagged entry with a readable version, and a timeout (the stub sleeps; the timeout is shortened through an env seam).
- Each asserts `CLI_STATE` and the outcome line, and that same, newer, linked and unknown make no `npm view` and no `npm i -g` call.
- `--no-confirm` with a newer client: asserts no downgrade.
- `PATH` check: a temp prefix with a fake `arcanum` earlier on `PATH`, and a run where the prefix `bin` is not on `PATH`.
- The semver comparison: a table-driven test of the wrapper.

## Alternatives considered

- **Auto-downgrading a client that is newer than the target.** Rejected: it would undo a deliberate `arcanum self-update`, and a newer client is safe against older config tiers.
- **`arcanum --version` for detection, alone or as a fallback.** Rejected: it does not identify the npm-managed package the install would replace.
- **Treating unknown as not installed** (prompt and install). Rejected: it could silently downgrade a newer client that `npm ls` failed to report.
- **Using `npm ls`'s exit code.** Rejected: `1` means both "missing" and "problem".
- **Running the foreign binary to identify it.** Rejected: it executes unknown code.
- **Refusing to install when a foreign binary exists.** Rejected: the step does not touch it, so a valid install would be blocked for nothing.
- **`npm i -g --force` on `EEXIST`.** Rejected: it overwrites another package's binary.
- **`sort -V` in bash for the comparison.** Rejected: it orders prereleases after their release, and older macOS BSD `sort` lacks `-V`.
- **Equality only (update whenever different).** Rejected: it breaks never-downgrade.
- **Comparing a linked checkout's version and updating it when older.** Rejected: `npm i -g` would replace the symlink and silently break a contributor's dev setup, and a dev checkout's version is often deliberately stale.

## Open points

None left in this part. The shared open point (the exact prompt and warning wording) stays in the index's [Open points](../cli-install.md#open-points).
