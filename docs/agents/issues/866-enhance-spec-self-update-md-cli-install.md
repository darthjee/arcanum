# Issue: Enhance spec: self-update.md (CLI install)

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum). Owner: `architect` (docs only; the implementation issue goes to the `client` agent).

Enhance `docs/agents/specs/cli-install/self-update.md` from its skeleton into a complete design that an implementation issue can follow without reopening #861. The part covers the new CLI command `arcanum self-update`: what it runs, when it refuses, its output and `--json` shape, its exit codes (mapped through `cli/lib/exitCodes.js`), its failures, and its place in `--help` and `docs/guides/arcanum-cli.md`.

## Problem

The skeleton only says that `arcanum self-update` runs `npm i -g arcanum-cli@latest`, and leaves open the `--json` shape, the exit codes and how npm failures map onto `cli/lib/exitCodes.js`. A blind `@latest` install cannot report what it installed, breaks the spec's exact-pin rule, and would silently replace an `npm link` dev checkout or install a global copy when the running one is `npx` or project-local. Without these decisions, the implementation issue would have to reopen the epic.

## Expected Behavior

- `self-update.md` describes the observable behavior: output lines, the `--json` object, exit codes, and the env vars that do or do not apply.
- It lists edge cases and failure modes, each with its outcome.
- It states the testing strategy for its implementation.
- It has a complete **Alternatives considered** section.
- Its "Open points" are all resolved; anything touching another part is resolved there or moved to the index's open points.
- Out of scope, recorded as such: a version argument, `--check`, changes to the version-skew hints, and Windows.

## Solution

### What the command does

Resolve first, then install the exact version (never a blind `@latest` install):

1. Look up `latest` with `npm view arcanum-cli@latest version --json`, bounded like the installer: `--fetch-retries=0` and a `--fetch-timeout` of about 15 seconds.
2. Validate the result as a plain semver (`MAJOR.MINOR.PATCH[-prerelease]`). Anything else is an error, and `npm i -g` is never called.
3. Compare it with the **running** CLI's own version (`CLI_VERSION`, embedded in the bundle; no `npm` call), using the same semver precedence as [already-installed.md](../specs/cli-install/already-installed.md) (prereleases rank below their release):
   - **same**: print `arcanum-cli is up to date (<v>)`, exit `0`, no install;
   - **running is older**: run `npm i -g --ignore-scripts "arcanum-cli@<v>"`, with the exact version as one argument, then print `Updated arcanum-cli <from> → <to>`;
   - **running is newer than `latest`** (a prerelease or a local build): no downgrade, an info line, exit `0`. A rollback belongs to the out-of-scope version argument.

Why: the output names the exact version installed, the command follows the shared exact-pin and `--ignore-scripts` rules, and an up-to-date client costs one lookup and changes nothing on the machine.

"Current" here means the running copy. When the running copy is not the global one (`npm link`, `npx`, a project-local install), see the already-installed cases below.

### Already-installed cases (is the running copy the global one?)

Before `npm view`, the command checks that the running copy is the global install, with a local call only (no network): the running package directory (from `import.meta.url`, `realpath`) is compared with `realpath "$(npm root -g)/arcanum-cli"`. A refusal therefore never costs a network call.

| Case | Recognized by | Outcome |
| --- | --- | --- |
| Global install | real paths match, and `$(npm root -g)/arcanum-cli` is a plain directory | proceed with the flow above |
| Linked dev checkout (`npm link`) | `$(npm root -g)/arcanum-cli` is a symlink | refuse: `running from a linked checkout (<path>); update it with git pull and a rebuild`. Never `npm i -g`, which would silently replace the link |
| Not the global copy: `npx`, a project-local `node_modules/.bin/arcanum`, a source run (`0.0.0-dev`) | real paths differ, or no global `arcanum-cli` | refuse: `this arcanum-cli (<path>) is not the global install`, with a hint to run `npm i -g arcanum-cli@latest` or update it through the project's package manager. Never install a global copy the user didn't ask for |
| `npm root -g` fails or times out | non-zero exit or timeout | error: npm is unusable |

Both refusals exit **non-zero**: the user asked for an update and did not get one, so `arcanum self-update && …` must not continue. This differs from the no-op outcomes ("up to date", "newer than latest"), which exit `0` because the client is in a good state, and from [already-installed.md](../specs/cli-install/already-installed.md), where a linked client is only an info line because the arcanum install itself succeeded. The exact codes are set under Exit codes.

### Confirmation

No prompt, no `--yes` flag, no TTY handling. Typing `arcanum self-update` is the consent: the shared `[Y/n]` rule exists because the installer and updater install the client as a side effect, while here the update is the whole request. The change is narrow (it only replaces the already-global `arcanum-cli` with a newer version of itself; the risky cases are refused above), it matches `rustup self update`, `gh extension upgrade`, `npm update -g` and `pipx upgrade`, and it keeps the command scriptable (`--json`, no TTY, an agent's Bash call) with no `FALLBACK=chat` path.

Before `npm i -g` runs, the command prints a progress line (`Updating arcanum-cli <from> → <to>...`) so a slow install isn't silent; see Output for where it goes under `--json`.

### Output and `--json`

Follows the conventions of `cli/lib/output.js`: stdout carries only the result, notes and warnings go to stderr as plain text in both modes, and refusals and errors go through `reportError`.

npm's own output is **captured, never inherited** (npm prints `changed 1 package in 2s` on stdout, which would break the one-JSON-object rule). On success it is dropped (shown on stderr under `ARCANUM_DEBUG=1`); on failure its last few stderr lines follow the `arcanum: ...` error, so the cause (EACCES, ETARGET, network) is visible.

| Outcome | stderr | stdout (human) |
| --- | --- | --- |
| updated | `arcanum: note: updating arcanum-cli <from> → <to>...` (before `npm i -g`) | `Updated arcanum-cli <from> → <to>` |
| up to date | nothing | `arcanum-cli is up to date (<v>)` |
| newer than latest | nothing | `arcanum-cli <v> is newer than the latest release (<latest>); nothing to do` |
| refusal or error | `arcanum: <message>` and `hint: <hint>` | nothing |

Under `--json`, stdout is exactly one object; the progress note stays on stderr as plain text:

```json
{"status":"updated","from":"2.2.3","to":"2.3.0","latest":"2.3.0"}
{"status":"up_to_date","from":"2.3.0","to":"2.3.0","latest":"2.3.0"}
{"status":"newer","from":"2.4.0-rc.1","to":"2.4.0-rc.1","latest":"2.3.0"}
```

`from` is the version running before the command and `to` the global version after it (equal on a no-op); `status` is a closed enum (`updated`, `up_to_date`, `newer`). Refusals and errors use the existing stable error object on stderr (`{"error":{"code","exit","message","hint"}}`). No restart message: the next `arcanum` call runs the new version.

### Exit codes

`exitCodeForError` maps any Node errno error to `7` (`file`), so a missing npm (`spawn` → `ENOENT`) would surface as a file error. The command wraps every npm failure in its own `CliError`.

| Code | Identifier | Used for |
| --- | --- | --- |
| `0` | — | updated, up to date, newer than latest |
| `4` | `target_unavailable` (reused) | refusals: linked checkout, not the global copy (nothing for the command to act on) |
| `8` | `npm` (**new**) | npm missing, or any npm call failing |
| `1` / `2` | existing | Node below the floor (already checked by `bin/arcanum`); usage errors, e.g. an extra argument |

The new `8` lets scripts tell "npm or the network broke" from "refused" without overloading `1`. It is added (never renumbered) to `cli/lib/exitCodes.js` (`EXIT_NPM`, `EXIT_IDENTIFIERS`, an `NpmError` class) and to the Exit codes table of `docs/agents/architecture/arcanum-cli.md`.

### Failures

All exit `8`. The command never retries with `sudo`.

| Failure | Message / hint |
| --- | --- |
| npm not on `PATH` (`ENOENT`) | `npm not found on PATH` / `install Node.js and npm, then run it again` |
| `npm root -g` fails or times out (about 15 s) | `could not locate the npm global install (npm root -g failed)`, plus npm's last lines |
| `npm view`: network error or timeout | `could not reach the npm registry` / `check your network or npm proxy/registry config` |
| `npm view`: `E404` (e.g. a custom registry without the package) | `arcanum-cli is not on the configured registry (<registry>)` |
| `npm view` returns something that is not a semver | `npm returned an invalid version '<x>'`; no install runs |
| `npm i -g`: `EACCES` / `EPERM` | `the npm global prefix (<prefix>) is not writable` / `fix its permissions or use a user-owned prefix (npm config set prefix ~/.npm-global); arcanum never retries with sudo` |
| `npm i -g`: any other failure | `npm i -g failed (exit <n>)`, plus npm's last stderr lines |

Timeouts: `npm root -g` about 15 s; `npm view` runs with `--fetch-retries=0 --fetch-timeout=15000` and a process timeout of about 30 s as a backstop; `npm i -g` has none (the user asked and is waiting). `EACCES` is detected from npm's captured stderr (`npm error code EACCES`); anything else falls into the generic row, so a misdetection never hides an error.

### Shared rules

How each of the index's [shared rules](../specs/cli-install.md#shared-rules) applies:

| Shared rule | In `self-update` |
| --- | --- |
| Version pinning (arcanum version) | does not apply, as the index says: the target is `latest`, resolved to an exact version |
| Exact pin, one argument, `--ignore-scripts` | applies: `npm i -g --ignore-scripts "arcanum-cli@<v>"` through `execFile` (no shell) |
| Validated version | applies, to the `npm view` result |
| Bounded `npm view` | applies (see Failures) |
| npm config honored, no registry override | applies; the registry is only named in the `E404` message |
| Forks: always `arcanum-cli` | applies |
| `ARCANUM_SKIP_CLI` | **ignored**: it skips the client step installs and updates run as a side effect; an explicit `arcanum self-update` is not a side effect, and silently doing nothing would confuse |
| `ARCANUM_ASSUME_YES`, `--no-confirm`, `ARCANUM_CLI_PROMPT`, `FALLBACK=chat` | do not apply: no prompt |
| Warn and continue | **does not apply**: the update is the command itself, so its failures are errors (exit `8`) |
| Node floor (22.13.0) | already enforced by `bin/arcanum` before any command runs |

### `--help` and docs

- Top-level usage: a new Commands row, `self-update   Update this CLI to the latest release`.
- `arcanum self-update --help`: the synopsis `Usage: arcanum self-update [--json]`, one paragraph on what it does and what it refuses, and the options `--json` and `-h, --help`.
- Arity: no positionals. An extra argument is `self-update: unexpected argument 'x'` (exit `2`); that is where the out-of-scope version argument would plug in later.
- Targeting flags (`--repo <path>`, `--claude-config-dir`) mean nothing here and are usage errors (`--claude-config-dir is not accepted by self-update`), in the style of `info` rejecting tier flags.

Docs the implementation updates:

| Doc | Change |
| --- | --- |
| `docs/guides/arcanum-cli.md` | Setup: an "Updating the CLI" paragraph (`arcanum self-update`, the refused cases, the EACCES advice). Troubleshooting: exit `8` and `self-update`'s exit `4`; the exit `5` entry may mention `arcanum self-update` as the easy update |
| `cli/README.md` | one line under install: `arcanum self-update` updates it later |
| `docs/agents/architecture/arcanum-cli.md` | Commands, the Exit codes table (`8`), JSON output (the `status` object), module layout (`cli/lib/commands/selfUpdate.js`) |

The version-skew hint emitted by the code (`cli/lib/skew.js`: `npm i -g arcanum-cli@latest`) is unchanged, as the issue scopes out; only the guide's prose mentions `self-update`.

### Edge cases

| Edge case | Outcome |
| --- | --- |
| Running bundle replaced mid-run | safe: the bundle is one file loaded at start. Implementation constraint: no lazy `import()` after `npm i -g` |
| Post-install verification | after npm exits `0`, read `$(npm root -g)/arcanum-cli/package.json` (a file read, no npm call); a version other than `<v>` is exit `8`, `npm i -g reported success but arcanum-cli is at <x>`. This makes `to` a fact |
| nvm / another Node: the running copy belongs to Node A, `npm` on `PATH` to Node B | real paths differ → the "not the global install" refusal; its hint adds `(a different Node/npm on PATH? e.g. nvm)` |
| Run through a symlinked bin (`/usr/local/bin/arcanum` → `.../node_modules/arcanum-cli/bin/arcanum`) | `realpath` resolves it; normal flow |
| Running a prerelease (`2.3.0-rc.1`) with `latest` at `2.3.0` | older → updates (semver precedence) |
| `latest` itself is a prerelease | same comparison, no special case |
| Two `self-update`s at once | not guarded (the tier-file lock doesn't apply, npm doesn't lock global installs); the second may fail with an npm error (exit `8`). Documented, not handled |
| Ctrl-C during `npm i -g` | the signal reaches npm (same process group); exit `130` with `the install may be incomplete; run arcanum self-update again`, also naming `npm i -g arcanum-cli@latest` since `arcanum` may no longer run |
| Windows (`npm.cmd`; `execFile` on `.cmd` without a shell throws `EINVAL` since the CVE-2024-27980 fix) | out of scope (arcanum itself is POSIX): on `win32`, error before any npm call, `self-update is not supported on Windows`, hint `npm i -g arcanum-cli@latest`, exit `1` |

### Scope

- In: the `arcanum self-update` command as described above, the new exit code `8`, its help, and the doc updates listed under `--help` and docs.
- Out (recorded in the part's Alternatives): a version argument (pin or roll back), a `--check` dry run, changes to the version-skew hints in `cli/lib/skew.js`, Windows support, a guard against concurrent runs.

### Testing strategy

- Unit specs (`cli/spec/lib/commands/selfUpdate_spec.js`) inject the npm runner through the existing `deps` channel: a fake `execFileAsync`, plus fakes for `realpath`, `lstat`, the `package.json` read and `process.platform`. No spec touches the real npm or network. One spec per row of the outcome, failure and edge-case tables, asserting stdout, stderr, the `--json` object and the exit code.
- Exact npm argv specs: `--ignore-scripts`, the package as one argument, `--fetch-retries=0 --fetch-timeout=15000`, no `--registry`, no `sudo`, and `npm i -g` never called on a refusal or an invalid version.
- `exitCodes_spec.js`: `8` / `npm` exists, and an `ENOENT` from the npm spawn maps to `8`, not `7`.
- `help_spec.js` and `main_spec.js`: the top-level row and the `self-update` usage; arity and targeting-flag usage errors.
- No real-install smoke test in CI (it would mutate the global prefix). Manual check before release: `npm i -g arcanum-cli@<old>`, then `arcanum self-update`.

### Security and performance

- `execFile` with no shell, a validated semver, and the package as one argument: the `npm view` output cannot inject anything.
- `--ignore-scripts`: a compromised publish cannot run code at install time. It would still run on the next `arcanum` call; that is inherent to any self-updater and is documented, not mitigated.
- No `sudo`, ever.
- Cost: an up-to-date client costs one local `npm root -g` and one bounded `npm view`; a refused case makes no network call.

### Backward compatibility and migration

- Purely additive: a new command, and a new exit code `8` that changes no existing code.
- No migration: no config shape changes. The `next/001` global migration (#872) covers the client install, not this command.

### Alternatives considered (additions to the part)

- A blind `npm i -g arcanum-cli@latest`: rejected, the output could not name the installed version, it breaks the exact-pin rule, and it reinstalls even when up to date.
- Updating the global copy when the running copy is not the global one: rejected, it would replace an `npm link` checkout or install a copy the user didn't ask for.
- A `[Y/n]` prompt with `--yes`: rejected, the command is the consent; the prompt only adds TTY, no-TTY and `--json` handling.
- Mapping npm failures to `1`, or letting `ENOENT` fall to `7`: rejected, scripts need a stable "npm failed" signal, and `7` means a file error.
- Warn and continue: rejected, the update is the command itself.
- `shell: true` for Windows: rejected, Windows is out of scope.
- Honoring `ARCANUM_SKIP_CLI`: rejected, it skips a side effect, not an explicit command.

## Benefits

- Users update the client with one command that names exactly what it installed, and never silently replaces a dev checkout.
- Scripts and agents get a stable `--json` result and distinct exit codes for "refused" and "npm failed".
