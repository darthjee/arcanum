# Issue: Enhance spec: already-installed.md (CLI install)

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Enhance `docs/agents/specs/cli-install/already-installed.md` from its skeleton into a complete design that an implementation issue (#868) can follow without reopening #861. Docs only. Owner: architect.

The part covers:

- Detecting an existing global `arcanum-cli` and its version.
- Already installed and older than the target: update it in place to `arcanum-cli@<arcanum version>`, with no failure and no duplicate install.
- Already at the target version: no-op, with a one-line note.
- Newer than the target (for example after `arcanum self-update`): leave it, never downgrade, and print a note with the manual downgrade command.
- A linked dev checkout and a foreign `arcanum` binary on `PATH`.
- How the outcome is reported (installed, updated, unchanged, newer kept, linked, unknown, skipped).

## Problem

`already-installed.md` only records three decisions (older → update, same → no-op, newer → leave) and leaves two open points: how the installed version is detected, and how a foreign `arcanum` binary on `PATH` is handled. It has no flow, outcomes, names, testing strategy or edge cases, so #868 cannot implement the double-installation behavior of the shared client-install script from it.

## Expected Behavior

- The part describes the observable behavior: prompts, output lines, exit codes and env vars / output keys.
- It lists edge cases and failure modes, each with its outcome.
- It states the testing strategy for its implementation.
- It has an **Alternatives considered** section.
- Its Open points become "None left"; anything touching another part is synced into that part (index, `install.md`, `update.md`).

## Solution

### Detection (resolves open point 1)

- **Single source:** `npm ls -g --json --depth=0 arcanum-cli`. It asks the same `npm` and global prefix that `npm i -g` installs into, so with nvm or several Node installs, detection and install always target the same client. It needs no network, and `--depth=0` keeps it fast.
- **Parse the JSON, never the exit code.** `npm ls` exits `1` both when the package is missing and on some tree problems, so the shared script parses stdout with `node -e` (Node is already confirmed by the Node/npm check; no `jq`):
  - `.dependencies["arcanum-cli"].version` present → **installed** at that version.
  - Valid JSON with no `arcanum-cli` entry (e.g. `{"name":"lib"}`) → **not installed**; the plain install flow from [install.md](install.md) runs.
  - No output, invalid JSON, or an entry without `version` → **unknown**.
- **Unknown → warn and skip.** A warning naming the reason and the manual command (`npm i -g arcanum-cli@<version>`), no `npm i -g` call, exit `0`. This keeps never-downgrade absolute: a client whose version cannot be read might be newer than the target.
- **`arcanum --version` is not used for detection.** It may resolve to another prefix's binary or a foreign `arcanum` on `PATH`, or to a CLI too old to support the flag.

#### Alternatives considered

- **`arcanum --version`, alone or as a fallback.** Rejected: it does not identify the npm-managed package the install would replace.
- **Unknown treated as not installed** (prompt and install). Rejected: it could silently downgrade a newer client that `npm ls` failed to report.
- **Using `npm ls`'s exit code.** Rejected: `1` means both "missing" and "problem".

### Foreign `arcanum` on `PATH` (resolves open point 2)

- **Warn only; never blocks or changes what is installed.** Detection stays on `npm ls`, so a foreign binary never affects the older/same/newer decision. The foreign binary is never run, removed or inspected.
- **When:** after the client step, only when it ends with `arcanum-cli` present (installed, updated, unchanged, newer kept). Skipped, declined and failed paths make no extra call.
- **How:** compare the resolved directory of `command -v arcanum` with `$(npm prefix -g)/bin`, both resolved with `cd -P … && pwd -P` so symlinked `PATH` entries do not false-alarm. Both calls are local. Arcanum's scripts are bash-only, so the Windows prefix layout (no `bin/`) does not apply.

| Case | Outcome |
| --- | --- |
| `arcanum` resolves into the npm global `bin` | Nothing extra. |
| `arcanum` resolves elsewhere (another nvm version's client, Homebrew/hand-built binary, unrelated tool) | Warning: `arcanum` on `PATH` is `<path>`, not the client at `<prefix>/bin/arcanum`; hint to reorder `PATH` or remove the other one. |
| `arcanum` not on `PATH` | Warning: the client is at `<prefix>/bin/arcanum`, but `<prefix>/bin` is not on `PATH`. |

- **Another npm package already owns `<prefix>/bin/arcanum`:** `npm i -g` fails with `EEXIST`. This is the existing "other `npm` failure" outcome (warning with the reason and the manual command, exit `0`). `--force` is never passed.

#### Alternatives considered

- **Running the foreign binary to identify it.** Rejected: it executes unknown code.
- **Refusing to install when a foreign binary exists.** Rejected: the step does not touch it, so a valid install would be blocked for nothing.
- **`npm i -g --force` on `EEXIST`.** Rejected: it overwrites another package's binary.

### Flow placement & performance

Detection runs before `npm view`, so only an install that would actually happen touches the network. The client step (`install.md` step 5, shared by every caller) becomes:

1. `ARCANUM_SKIP_CLI` set → skip.
2. `VERSION` not plain semver → warn and skip.
3. No TTY and no opt-in flag → skip with a warning.
4. `node`/`npm` present and Node ≥ 22.13.0, else warn and skip.
5. **Detect** with `npm ls -g --json --depth=0 arcanum-cli` (local):
   - unknown → warn and skip;
   - same as target → info "already up to date", done;
   - newer than target → info with the downgrade command, done;
   - linked dev checkout → info, done;
   - older or not installed → continue.
6. `npm view arcanum-cli@<version>` → unpublished or network error: warn and skip.
7. Prompt (`current → target` for an older client).
8. `npm i -g --ignore-scripts arcanum-cli@<version>`.
9. `PATH` check (see above).

- **Same/newer cost one local `npm ls`:** no `npm view`, no prompt.
- **Detection stays after the TTY check**, even though same/newer need neither TTY nor prompt, so the index's "no TTY → no `npm` call" and "skipped paths cost nothing" rules stay simple and unchanged.
- **`/arcanum-update` resume:** `FALLBACK=chat` + exit `4` happens only on the path that reaches step 7. Same and newer end with exit `0` without asking in chat.
- **Bounded `npm ls`:** run through the `node -e` wrapper with `spawnSync(..., { timeout: ~15s })` (macOS has no portable `timeout`). A timeout counts as **unknown** → warn and skip.
- **Sync:** `install.md`'s Flow (steps 5.4/5.5) and the index's "Skipped paths cost nothing" line ("one `npm view` and the installed-version check before asking") are updated to this order.

### Version comparison

- **Semver precedence:** `MAJOR.MINOR.PATCH` numerically; on a tie, a version with a prerelease is lower than one without (`2.3.0-rc.1` < `2.3.0`); prereleases compare identifier by identifier (numeric identifiers numerically, others in ASCII order, numeric before alphanumeric); build metadata (`+…`) is ignored.
- **Implemented in the same `node -e` wrapper** that runs and parses `npm ls` (~15 lines of plain JS, no `semver` dependency). It prints `CLI_STATE=missing|older|same|newer|linked|unknown` and, when known, `CLI_INSTALLED=<v>`; the bash side is a plain `case`.
- **Unparseable installed version** → `unknown` → warn and skip. The target is already validated as plain semver before this step.
- **Prerelease target, release installed** (target `2.3.0-rc.1`, installed `2.3.0`) → `newer` → left as is, with a note. Covered by an explicit test.

#### Alternatives considered

- **`sort -V` in bash.** Rejected: it orders prereleases after their release, and older macOS BSD `sort` lacks `-V`.
- **Equality only (update whenever different).** Rejected: it breaks never-downgrade.

### Prompt & outcome reporting

- **Prompt (older client only):** the same `[Y/n]` prompt from `/dev/tty`, default yes, worded as an update naming both versions, e.g. `Update arcanum-cli 2.2.3 → 2.3.0 (npm i -g)? [Y/n]`. With no client installed, `install.md`'s install prompt is used unchanged.
- **`/arcanum-update` fallback:** the `AskUserQuestion` uses the same wording, so on exit `4` the shared script also prints `CLI_INSTALLED=<v>` (after `FALLBACK=chat` and `CLI_VERSION=<v>`) whenever a client is installed. This extends #864's contract additively; an old skill ignores the extra line. `update.md`'s Names section gains it.
- **Outcomes:** every case exits `0` and prints one line on stderr (the `install.md` convention). Exact wording stays open for #868; the table fixes each line's content.

| Case | Condition | Output | Exit |
| --- | --- | --- | --- |
| Updated | Older; user accepts; `npm i -g` succeeds. | Info: `arcanum-cli` updated `<old>` → `<target>`. | `0` |
| Unchanged | Installed equals target. | Info: `arcanum-cli@<v>` already up to date. No prompt, no `npm view`. | `0` |
| Newer kept | Installed is newer than target. | Info (not a warning): `arcanum-cli@<installed>` is newer than `<target>`, left as is; downgrade with `npm i -g --ignore-scripts arcanum-cli@<target>`. No prompt, no `npm view`. | `0` |
| Linked | Client is an `npm link` dev checkout. | Info: linked from `<path>`, left as is. No prompt, no `npm view`, no `npm i -g`. | `0` |
| Unknown | `npm ls` timed out, failed, or gave no readable version. | Warning with the reason and the manual command. No `npm i -g`. | `0` |
| Declined (update) | Older; user answers no. | Info with the manual command. | `0` |
| Update failed | `npm i -g` fails (EACCES, EEXIST, network). | `install.md`'s matching warning rows, unchanged. The old client stays in place. | `0` |
| `PATH` warning | See [Foreign `arcanum` on `PATH`](#foreign-arcanum-on-path-resolves-open-point-2). | One extra warning line after the outcome line. | `0` |

- **"Newer kept" is info**, because it is the expected state after `arcanum self-update`.

### Edge cases

| Case | Outcome |
| --- | --- |
| Half-installed package (`npm ls` entry without `version`, or `missing: true`) | `unknown` → warn and skip. |
| Entry flagged `invalid`/`extraneous` but with a readable `version` | Version trusted; normal flow (`npm ls` exits `1` here, hence JSON parsing). |
| `npm ls` hangs | ~15 s timeout → `unknown` → warn and skip. |
| Client installed under another prefix (another nvm Node) | Not seen → `missing` → installed into the active prefix; the `PATH` check warns if the other copy comes first. |
| Node switched since the last update | Same as above: detection always follows the active `npm`. |
| `npm i -g` fails midway | Update failed → warning; npm keeps or restores the old client. No retry. |
| **Linked dev checkout** (`npm link` from `cli/`: entry with `link: true` or `resolved: "file:…"`) | New state `CLI_STATE=linked` → info "`arcanum-cli` is linked from `<path>`, left as is". No prompt, no `npm view`, no `npm i -g`, whatever its version. |

#### Alternatives considered

- **Comparing a linked checkout's version and updating it when older.** Rejected: `npm i -g` would replace the symlink and silently break a contributor's dev setup; a dev checkout's version is often deliberately stale.

### Interaction with each caller

One implementation in the shared script (#868, e.g. `arcanum/_lib/install_cli.sh`); no per-caller code. Callers differ only in how consent arrives:

| Caller | Consent | Older client | Same / newer / linked / unknown |
| --- | --- | --- | --- |
| Installer (`installer.sh`) | TTY prompt | Update prompt, `current → target` | Info/warning, exit `0` |
| Updater, zip (`updater.sh`) | TTY prompt | Same | Same |
| Updater, git (`bootstrap.sh` → script from the checked-out tree) | TTY prompt | Same | Same |
| `/arcanum-update` (`ARCANUM_CLI_PROMPT=chat`, no TTY) | Exit `4` with `FALLBACK=chat`, `CLI_VERSION`, `CLI_INSTALLED` → `AskUserQuestion` → `install-cli <v>` with `--no-confirm` | Skill asks `current → target` | Exit `0`, no chat question; the line reaches the user through inherited stdio |
| Migration `next/001` (`--no-confirm`; `[R]un` is the consent) | None | Updated directly | Same rules: never downgrade, `linked` left alone, `unknown` skipped |

- **`--no-confirm` only answers the prompt; it never bypasses detection.** The index's description of `--no-confirm` gains this.
- **The resume re-detects:** `install-cli <v>` runs the full flow with `--no-confirm`, so a state change between the question and the answer (e.g. a `self-update` meanwhile) is handled. Cost: one more local `npm ls`.
- **Installer:** "already installed" is rare on a fresh arcanum install but possible (CLI from an earlier arcanum or installed by hand); nothing is special-cased.
- **Sync:** `update.md`'s Names gains `CLI_INSTALLED=`; `install.md` step 5.5 points here for the reordered detection.

### Scope

- **In:** already-installed behavior (detection, comparison, `linked`, unknown, foreign binary), its outcomes, testing strategy and alternatives in `already-installed.md`; syncing the index, `install.md` and `update.md`. Docs only.
- **Out:** `self-update`'s own behavior (#866), the shared script (#868), the skill (#870), the migration file (#872), exact prompt/warning wording (#868).

### Testing strategy (for #868)

- bats tests with a stub `npm` returning canned `npm ls --json` output: missing, older, same, newer, prerelease target with release installed, `linked`, entry without `version`, invalid JSON, `invalid`-flagged but readable, and a timeout (stub sleeps; the timeout is shortened through an env seam).
- Each asserts `CLI_STATE` and the outcome line, and that same/newer/linked/unknown make no `npm view` and no `npm i -g` call.
- `--no-confirm` with a newer client: asserts no downgrade.
- `PATH` check: a temp prefix with a fake `arcanum` earlier on `PATH`, and a run where the prefix `bin` is not on `PATH`.
- The semver comparison: a table-driven test of the wrapper.

### Other checklist concerns

- **Backward compatibility:** nothing beyond the index; `CLI_INSTALLED=` is additive, and `linked`/`unknown` only make the step do less.
- **Migration:** nothing new; `next/001` reuses the shared script and inherits these rules.
- **Script-driven interaction:** covered by the shared script (TTY prompt, exit `4` `FALLBACK=chat`).
- **New root-level folder:** none.
- **Owner:** architect (docs/specs).

### Spec deliverable

`already-installed.md` gains Flow, Outcomes, Names (`CLI_STATE`, `CLI_INSTALLED`), Testing strategy and Alternatives sections built from the above, and its Open points become "None left". The index, `install.md` and `update.md` are synced as noted in each section.

## Benefits

- #868 can implement detection and comparison without design work, with a test per outcome.
- Never-downgrade becomes absolute, including for the migration's `--no-confirm` path and unreadable states.
- Routine updates where the client is already current cost one local `npm ls`: no network call and no prompt.
- Contributors' `npm link` dev setups are never overwritten.
