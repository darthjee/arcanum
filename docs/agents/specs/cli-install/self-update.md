# CLI Install: Self-Update

Part of the [CLI Install](../cli-install.md) spec. Unlike the other parts, this command does not use the arcanum version pin: see [Version pinning](../cli-install.md#version-pinning). The other [shared rules](../cli-install.md#shared-rules) apply as listed under [Shared rules](#shared-rules) below.

## Purpose

Give the client a way to update itself. Today the CLI only has `config`, so this is a new command.

## Decisions

- New CLI command: `arcanum self-update`.
- The name avoids confusion with updating the arcanum install itself (`/arcanum-update`, `arcanum/update/`).

### What it runs

The command resolves `latest` first, then installs that exact version. It never runs a blind `npm i -g arcanum-cli@latest`.

1. Look up `latest` with `npm view arcanum-cli@latest version --json`, bounded like the installer (see [Failures](#failures)).
2. Validate the result as a plain semver (`MAJOR.MINOR.PATCH[-prerelease]`). Anything else is an error, and `npm i -g` is never called.
3. Compare it with the **running** CLI's own version (`CLI_VERSION`, embedded in the bundle; no `npm` call), using the semver precedence of [already-installed.md](already-installed.md#version-comparison) (a prerelease ranks below its release):
   - **same:** `up_to_date`, exit `0`, no install;
   - **running is older:** `npm i -g --ignore-scripts "arcanum-cli@<v>"`, with the exact version as one argument, then `updated`;
   - **running is newer than `latest`** (a prerelease or a local build): `newer`, exit `0`, no downgrade. A rollback belongs to the out-of-scope version argument.
4. After npm exits `0`, read `$(npm root -g)/arcanum-cli/package.json` (a file read, no npm call). A version other than `<v>` is an error, so `to` in the output is a fact.

This way the output names the exact version installed, the command follows the shared exact-pin and `--ignore-scripts` rules, and an up-to-date client costs one lookup and changes nothing.

### Running copy vs global install

"Current" means the running copy. Before `npm view`, the command checks that the running copy is the global install, with local calls only: the running package directory (from `import.meta.url`, through `realpath`) is compared with `realpath "$(npm root -g)/arcanum-cli"`. A refusal therefore never costs a network call.

| Case | Recognized by | Outcome |
| --- | --- | --- |
| Global install | The real paths match, and `$(npm root -g)/arcanum-cli` is a plain directory. | Proceed with [What it runs](#what-it-runs). |
| Linked dev checkout (`npm link`) | `$(npm root -g)/arcanum-cli` is a symlink. | Refused: the checkout is updated with `git pull` and a rebuild. Never `npm i -g`, which would silently replace the link. |
| Not the global copy: `npx`, a project-local `node_modules/.bin/arcanum`, a source run (`0.0.0-dev`) | The real paths differ, or there is no global `arcanum-cli`. | Refused, with a hint to run `npm i -g arcanum-cli@latest` or to update through the project's package manager. Never installs a global copy the user did not ask for. |
| `npm root -g` fails or times out | Non-zero exit or timeout. | Error: npm is unusable. |

Both refusals exit non-zero (`4`, see [Exit codes](#exit-codes)): the user asked for an update and did not get one, so `arcanum self-update && …` must not continue. The no-op outcomes (`up_to_date`, `newer`) exit `0` because the client is in a good state. This differs from [already-installed.md](already-installed.md#linked-dev-checkout), where a linked client is only an info line, because there the arcanum install itself succeeded.

### No confirmation

No prompt, no `--yes` flag, no TTY handling. Typing `arcanum self-update` is the consent:

- The shared `[Y/n]` prompt exists because the installer and updater install the client as a side effect. Here the update is the whole request.
- The change is narrow: it only replaces the already-global `arcanum-cli` with a newer version of itself. The risky cases are refused above.
- It matches `rustup self update`, `gh extension upgrade`, `npm update -g` and `pipx upgrade`.
- It keeps the command scriptable (`--json`, no TTY, an agent's Bash call), with no `FALLBACK=chat` path.

Before `npm i -g` runs, a progress note goes to stderr, so a slow install is not silent (see [Outcomes](#outcomes)).

### Shared rules

How each of the index's [shared rules](../cli-install.md#shared-rules) applies:

| Shared rule | In `self-update` |
| --- | --- |
| Version pinning (arcanum version) | Does not apply: the target is `latest`, resolved to an exact version. |
| Exact pin, one argument, `--ignore-scripts` | Applies: `npm i -g --ignore-scripts "arcanum-cli@<v>"`, through `execFile` (no shell). |
| Validated version | Applies, to the `npm view` result. |
| Bounded `npm view` | Applies (see [Failures](#failures)). |
| npm config honored, no registry override | Applies. The registry is only named in the `E404` message. |
| Forks: always `arcanum-cli` | Applies. |
| `ARCANUM_SKIP_CLI` | **Ignored.** It skips the client step that installs and updates run as a side effect. An explicit `arcanum self-update` is not a side effect, and silently doing nothing would confuse. |
| Prompt, `ARCANUM_ASSUME_YES`, `--no-confirm`, `ARCANUM_CLI_PROMPT`, `FALLBACK=chat`, no-TTY skip | Do not apply: there is no prompt. |
| Warn and continue | **Does not apply.** The update is the command itself, so its failures are errors (exit `8`). |
| Node floor (22.13.0) | Already enforced by `bin/arcanum` before any command runs. |

### Exit codes

`exitCodeForError` maps any Node errno error to `7` (`file`), so a missing npm (`spawn` → `ENOENT`) would otherwise surface as a file error. The command wraps every npm failure in its own `NpmError`.

| Code | Identifier | Used for |
| --- | --- | --- |
| `0` | — | `updated`, `up_to_date`, `newer` |
| `4` | `target_unavailable` (reused) | Refusals: linked checkout, not the global copy. There is nothing for the command to act on. |
| `8` | `npm` (**new**) | npm missing, or any npm call failing, including the post-install verification. |
| `1` | `error` (existing) | Windows (see [Edge cases](#edge-cases)). Node below the floor, already checked by `bin/arcanum`. |
| `2` | `usage` (existing) | Usage errors, for example an extra argument or a targeting flag. |
| `130` | `interrupted` (**new**) | Interrupted by Ctrl-C during `npm i -g` (`InterruptedError`). |

The new `8` lets scripts tell "npm or the network broke" from "refused" without overloading `1`. The implementation adds it, never renumbering existing codes, to `cli/lib/exitCodes.js` (`EXIT_NPM`, its `EXIT_IDENTIFIERS` entry, the `NpmError` class, plus `EXIT_INTERRUPTED` / `interrupted` / `InterruptedError` for `130`) and to the [Exit codes](../../architecture/arcanum-cli.md#exit-codes) table of the architecture doc.

### `--help`

- Top-level usage: a new Commands row, `self-update   Update this CLI to the latest release`.
- `arcanum self-update --help`: the synopsis `Usage: arcanum self-update [--json]`, one paragraph on what it does and what it refuses, and the options `--json` and `-h, --help`.
- No positionals. An extra argument is a usage error (`self-update: unexpected argument 'x'`, exit `2`). That is where the out-of-scope version argument would plug in later.
- Targeting flags (`--repo <path>`, `--claude-config-dir`) mean nothing here and are usage errors (`--claude-config-dir is not accepted by self-update`), in the style of `info` rejecting tier flags.

## Flow

1. Platform check: on `win32`, error before any npm call (see [Edge cases](#edge-cases)).
2. Arity and flags: an extra argument or a targeting flag is a usage error.
3. `npm root -g` (local, about 15 s timeout) and the [global-copy check](#running-copy-vs-global-install): a linked or non-global copy is refused.
4. `npm view arcanum-cli@latest version --json`, bounded.
5. Semver validation of the result.
6. Compare with `CLI_VERSION`: `same` and `newer` end here with exit `0`.
7. Progress note on stderr.
8. `npm i -g --ignore-scripts "arcanum-cli@<v>"`.
9. Verification: read `$(npm root -g)/arcanum-cli/package.json`.
10. Result on stdout.

## Outcomes

The command follows the conventions of `cli/lib/output.js`: stdout carries only the result, notes and warnings go to stderr as plain text in both modes, and refusals and errors go through `reportError`.

npm's own output is **captured, never inherited**: npm prints `changed 1 package in 2s` on stdout, which would break the one-JSON-object rule. On success it is dropped (shown on stderr under `ARCANUM_DEBUG=1`). On failure its last few stderr lines follow the `arcanum: ...` error, so the cause (EACCES, ETARGET, network) is visible.

| Outcome | stderr | stdout (human) | `--json` | Exit |
| --- | --- | --- | --- | --- |
| Updated | `arcanum: note: updating arcanum-cli <from> → <to>...` (before `npm i -g`) | `Updated arcanum-cli <from> → <to>` | `status: "updated"` | `0` |
| Up to date | Nothing. | `arcanum-cli is up to date (<v>)` | `status: "up_to_date"` | `0` |
| Newer than latest | Nothing. | `arcanum-cli <v> is newer than the latest release (<latest>); nothing to do` | `status: "newer"` | `0` |
| Linked checkout | `arcanum: running from a linked checkout (<path>); update it with git pull and a rebuild` | Nothing. | error `target_unavailable` | `4` |
| Not the global copy | `arcanum: this arcanum-cli (<path>) is not the global install`, with the hint to run `npm i -g arcanum-cli@latest` or use the project's package manager | Nothing. | error `target_unavailable` | `4` |
| Any [failure](#failures) | `arcanum: <message>` and `hint: <hint>`, then npm's last stderr lines | Nothing. | error `npm` | `8` |

Under `--json`, stdout is exactly one object. The progress note stays on stderr as plain text.

```json
{"status":"updated","from":"2.2.3","to":"2.3.0","latest":"2.3.0"}
{"status":"up_to_date","from":"2.3.0","to":"2.3.0","latest":"2.3.0"}
{"status":"newer","from":"2.4.0-rc.1","to":"2.4.0-rc.1","latest":"2.3.0"}
```

- `from` is the version running before the command, `to` the global version after it (equal on a no-op), `latest` the resolved `npm view` result.
- `status` is a closed enum: `updated`, `up_to_date`, `newer`.
- Refusals and errors use the existing stable error object on stderr (`{"error":{"code","exit","message","hint"}}`).
- No restart message: the next `arcanum` call runs the new version.

### Failures

All exit `8`. The command never retries with `sudo`.

| Failure | Message / hint |
| --- | --- |
| npm not on `PATH` (`ENOENT`) | `npm not found on PATH` / `install Node.js and npm, then run it again` |
| `npm root -g` fails or times out | `could not locate the npm global install (npm root -g failed)`, plus npm's last lines |
| `npm view`: network error or timeout | `could not reach the npm registry` / `check your network or npm proxy/registry config` |
| `npm view`: `E404` (for example a custom registry without the package) | `arcanum-cli is not on the configured registry (<registry>)` |
| `npm view` returns something that is not a semver | `npm returned an invalid version '<x>'`; no install runs |
| `npm i -g`: `EACCES` / `EPERM` | `the npm global prefix (<prefix>) is not writable` / `fix its permissions or use a user-owned prefix (npm config set prefix ~/.npm-global); arcanum never retries with sudo` |
| `npm i -g`: any other failure | `npm i -g failed (exit <n>)`, plus npm's last stderr lines |
| Verification: the installed `package.json` is not at `<v>` | `npm i -g reported success but arcanum-cli is at <x>` |

- **Timeouts.** `npm root -g` about 15 s. `npm view` runs with `--fetch-retries=0 --fetch-timeout=15000` and a process timeout of about 30 s as a backstop. `npm i -g` has none: the user asked and is waiting.
- **EACCES detection.** It is read from npm's captured stderr (`npm error code EACCES`). Anything else falls into the generic row, so a misdetection never hides an error.

## Edge cases

| Edge case | Outcome |
| --- | --- |
| Running bundle replaced mid-run | Safe: the bundle is one file loaded at start. Implementation constraint: no lazy `import()` after `npm i -g`. |
| nvm or another Node: the running copy belongs to Node A, `npm` on `PATH` to Node B | The real paths differ, so the "not the global install" refusal. Its hint adds `(a different Node/npm on PATH? e.g. nvm)`. |
| Run through a symlinked bin (`/usr/local/bin/arcanum` → `.../node_modules/arcanum-cli/bin/arcanum`) | `realpath` resolves it; normal flow. |
| Running a prerelease (`2.3.0-rc.1`) with `latest` at `2.3.0` | Older, so it updates (semver precedence). |
| `latest` itself is a prerelease | Same comparison, no special case. |
| Two `self-update`s at once | Not guarded: the tier-file lock does not apply, and npm does not lock global installs. The second may fail with an npm error (exit `8`). Documented, not handled. |
| Ctrl-C during `npm i -g` | The signal reaches npm (same process group). Exit `130`, with `the install may be incomplete; run arcanum self-update again`, also naming `npm i -g arcanum-cli@latest`, since `arcanum` may no longer run. |
| Windows (`npm.cmd`; `execFile` on a `.cmd` without a shell throws `EINVAL` since the CVE-2024-27980 fix) | Out of scope (arcanum itself is POSIX). On `win32`, error before any npm call: `self-update is not supported on Windows`, hint `npm i -g arcanum-cli@latest`, exit `1`. |

## Names

| Name | Kind | Meaning |
| --- | --- | --- |
| `self-update` | CLI command | `arcanum self-update [--json]`. |
| `EXIT_NPM` / `npm` | exit code `8` and its identifier | npm missing, or an npm call failing. New, added to `cli/lib/exitCodes.js`. |
| `NpmError` | `CliError` subclass | Wraps every npm failure with exit `8` and code `npm`, carrying npm's last stderr lines. |
| `EXIT_INTERRUPTED` / `interrupted` | exit code `130` and its identifier | Ctrl-C during `npm i -g`. |
| `InterruptedError` | `CliError` subclass | The interruption, with exit `130` and code `interrupted`. |
| `cli/lib/npm.js` | module | `runNpm`: npm through `execFile` with captured output, classifying each failure. |
| `cli/lib/commands/selfUpdate.js` | module | The command's implementation. |
| `updated`, `up_to_date`, `newer` | `--json` `status` values | The closed enum of successful outcomes. |

## Docs the implementation updates

| Doc | Change |
| --- | --- |
| [`docs/guides/arcanum-cli.md`](../../../guides/arcanum-cli.md) | Setup: an "Updating the CLI" paragraph (`arcanum self-update`, the refused cases, the EACCES advice). Troubleshooting: exit `8` and `self-update`'s exit `4`; the exit `5` entry may mention `arcanum self-update` as the easy update. |
| `cli/README.md` | One line under install: `arcanum self-update` updates it later. |
| [`docs/agents/architecture/arcanum-cli.md`](../../architecture/arcanum-cli.md) | [Commands](../../architecture/arcanum-cli.md#commands), the [Exit codes](../../architecture/arcanum-cli.md#exit-codes) table (`8`), [JSON output](../../architecture/arcanum-cli.md#json-output) (the `status` object), [Module layout](../../architecture/arcanum-cli.md#module-layout) (`cli/lib/commands/selfUpdate.js`). |

The version-skew hint emitted by the code (`cli/lib/skew.js`: `npm i -g arcanum-cli@latest`) is unchanged; only the guide's prose mentions `self-update`.

## Testing strategy

For the implementation issue:

- Unit specs (`cli/spec/lib/commands/selfUpdate_spec.js`) inject the npm runner through the existing `deps` channel: a fake `execFileAsync`, plus fakes for `realpath`, `lstat`, the `package.json` read and `process.platform`. No spec touches the real npm or the network.
- One spec per row of the [Outcomes](#outcomes), [Failures](#failures) and [Edge cases](#edge-cases) tables, asserting stdout, stderr, the `--json` object and the exit code.
- Exact npm argv specs: `--ignore-scripts`, the package as one argument, `--fetch-retries=0 --fetch-timeout=15000`, no `--registry`, no `sudo`, and `npm i -g` never called on a refusal or an invalid version.
- `exitCodes_spec.js`: `8` / `npm` exists, and an `ENOENT` from the npm spawn maps to `8`, not `7`.
- `help_spec.js` and `main_spec.js`: the top-level row and the `self-update` usage; the arity and targeting-flag usage errors.
- No real-install smoke test in CI: it would mutate the global prefix. Manual check before release: `npm i -g arcanum-cli@<old>`, then `arcanum self-update`.

## Security and performance

- `execFile` with no shell, a validated semver, and the package as one argument: the `npm view` output cannot inject anything.
- `--ignore-scripts`: a compromised publish cannot run code at install time. It would still run on the next `arcanum` call. That is inherent to any self-updater and is documented, not mitigated.
- No `sudo`, ever.
- Cost: an up-to-date client costs one local `npm root -g` and one bounded `npm view`. A refused case makes no network call.

## Backward compatibility

- Purely additive: a new command, and a new exit code `8` that changes no existing code.
- No migration: no config shape changes. The `next/001` global migration (#872) covers the client install, not this command.

## Alternatives considered

- **Naming it `arcanum update` or `arcanum upgrade`.** Rejected: both read as updating the arcanum install, not the client.
- **Shipping a version argument** (to pin or roll back), **a `--check` dry run, or new version-skew hints** now. Deferred: out of scope for this epic. The skew hints keep saying `npm i -g arcanum-cli@latest`. Windows support and a guard against concurrent runs are out of scope too.
- **A blind `npm i -g arcanum-cli@latest`.** Rejected: the output could not name the installed version, it breaks the exact-pin rule, and it reinstalls even when up to date.
- **Updating the global copy when the running copy is not the global one.** Rejected: it would replace an `npm link` checkout or install a copy the user did not ask for.
- **A `[Y/n]` prompt with `--yes`.** Rejected: the command is the consent. The prompt would only add TTY, no-TTY and `--json` handling.
- **Mapping npm failures to `1`, or letting `ENOENT` fall to `7`.** Rejected: scripts need a stable "npm failed" signal, and `7` means a file error.
- **Warn and continue.** Rejected: the update is the command itself.
- **`shell: true` for Windows.** Rejected: Windows is out of scope.
- **Honoring `ARCANUM_SKIP_CLI`.** Rejected: it skips a side effect, not an explicit command.

## Open points

None left in this part. The shared open point (the exact wording of each message) stays in the index's [Open points](../cli-install.md#open-points).
