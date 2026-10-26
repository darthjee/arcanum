# Issue: Add the arcanum self-update CLI command

## Description

Part of epic #861 (Install and update the arcanum CLI together with arcanum).

Add the `arcanum self-update` command to the CLI, as specified in [`docs/agents/specs/cli-install/self-update.md`](../specs/cli-install/self-update.md) (merged in #866). The spec is the source of truth, together with the index [`docs/agents/specs/cli-install.md`](../specs/cli-install.md). If the spec turns out to be wrong during implementation, update it in the same PR.

Owner: `client` (`cli/`).

## Problem

The CLI only has `config`. Once installed, the only way to update it is a manual `npm i -g arcanum-cli@latest`, and the version-skew hints point there. Nothing in the CLI checks whether the running copy is the global install, so a naive self-updater would overwrite an `npm link` checkout or install a global copy the user never asked for.

The existing `compareVersions` in `cli/lib/skew.js` also ignores prerelease suffixes (`2.3.0-rc.1` equals `2.3.0`), which would make `self-update` report `up_to_date` for a release candidate.

## Expected Behavior

`arcanum self-update [--json]` behaves exactly as the spec describes:

- it refuses, with exit `4`, a linked checkout or a copy that is not the global install, before any network call;
- it resolves `latest` with a bounded `npm view`, validates it, and compares it with the running version by semver precedence;
- it installs the exact version with `npm i -g --ignore-scripts`, through `execFile` with no shell, and verifies the result;
- it never downgrades and never prompts;
- npm failures exit `8` (`npm`), Ctrl-C exits `130` (`interrupted`);
- under `--json`, stdout is one `{"status","from","to","latest"}` object.

## Solution

Implement the spec. The decisions below cover what the spec leaves to the implementation.

#### Version comparison (semver precedence)

`compareVersions` in `cli/lib/skew.js` drops the prerelease suffix today, so `2.3.0-rc.1` compares equal to `2.3.0`. `self-update` would then report `up_to_date` where the spec requires `updated`.

- Fix `compareVersions` itself to follow semver precedence (a prerelease ranks below its release; prerelease identifiers compared per semver), so the version-skew checks get the same fix.
- Keep it hand-written: no `semver` dependency, the bundle stays free of runtime dependencies.
- Add specs for the new precedence cases to `cli/spec/lib/skew_spec.js`, and check that existing skew specs still pass.

#### Locating the running package

- `cli/lib/commands/selfUpdate.js` walks up from `import.meta.url` to the nearest `package.json` named `arcanum-cli`, then takes the `realpath` of that directory.
- Specs inject the directory through `deps.packageDir`.
- A source run finds `cli/` (`0.0.0-dev`), whose real path differs from the global install, so it is refused as "not the global install", as intended.

#### Ctrl-C

- A promisified `execFile` rejects with `signal: 'SIGINT'` when the child is killed by Ctrl-C. Map that to exit `130` with the spec's hint.
- Tested with a fake `execFileAsync` that rejects with that shape; no real signal in specs.

#### Targeting flags

`--repo` and `--claude-config-dir` are parsed globally in `cli/lib/main.js` before dispatch. `self-update` throws a `UsageError` when `context.targeting.repo` or `context.targeting.claudeConfigDir` is set (`--claude-config-dir is not accepted by self-update`).

#### npm runner (`cli/lib/npm.js`)

#868's shared install script is bash, so `self-update` is the only Node caller of npm. The runner still gets its own module, so error classification is specced apart from the command's flow.

- `runNpm(args, { timeout, execFileAsync })` → `{ stdout, stderr }`. Always `execFile('npm', args)`, no shell, all output captured. On failure it throws a classified error.
- `selfUpdate.js` holds the flow (global-copy check → view → compare → install → verify) and its specs fake `runNpm`.
- The spec's Names table gains a `cli/lib/npm.js` row in the same PR.

Classification (npm 9+ prints `npm error code X`, older npm `npm ERR! code X`; matched with `/npm (?:error|ERR!) code (\S+)/`):

| Signal | Category |
| --- | --- |
| spawn `ENOENT` | npm not found |
| `killed` + `SIGTERM` (the `execFile` timeout) | timeout: network message for `view`, "npm root -g failed" for `root` |
| `signal: 'SIGINT'` | interrupted (exit `130`) |
| code `EACCES` / `EPERM` | prefix not writable |
| code `E404` | not on the configured registry |
| code `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT`, `ECONNRESET`, `ERR_SOCKET*` | network |
| anything else | generic `npm ... failed (exit <n>)` |

- **Prefix (EACCES message):** derived from the `npm root -g` result (`<prefix>/lib/node_modules`, two `dirname`s). No extra npm call.
- **Registry (E404 message):** `npm config get registry`, only on the E404 path, best-effort with a ~5 s timeout; falls back to "the configured registry".
- **Captured output on failure:** the last 10 lines of npm's stderr follow the `arcanum: ...` error.
- **Exit `130`:** a new `InterruptedError` (`CliError`, exit `130`, identifier `interrupted`) in `cli/lib/exitCodes.js`, separate from `NpmError`, so `--json` keeps the stable error object and scripts can tell "npm broke" (`8`) from "cancelled" (`130`).

#### Bundle smoke spec

Add one spec under `cli/spec/smoke/`: `arcanum self-update --help` exits `0` from the built bundle. It installs nothing.

#### Scope of the PR

One PR, owned by `client`:

- `cli/lib/exitCodes.js` (`EXIT_NPM`, its identifier, `NpmError`, `InterruptedError`), `cli/lib/main.js` (command registry), `cli/lib/help.js`, `cli/lib/skew.js`, and the new `cli/lib/npm.js` and `cli/lib/commands/selfUpdate.js`;
- `docs/agents/specs/cli-install/self-update.md`: the `cli/lib/npm.js` and `InterruptedError` rows in Names, and the `130` row naming `interrupted`;
- the specs listed in the spec's Testing strategy, plus the `skew_spec.js` and smoke additions above;
- the docs in the spec's "Docs the implementation updates" table, including exit `8` in the architecture doc.

Effect on the skew checks: a CLI at `2.3.0-rc.1` now ranks below a repo pointer at `2.3.0`, so it gets the skew warning it should have had.

## Benefits

- Users update the CLI with one command that names the exact version installed.
- Linked checkouts and non-global copies are never overwritten.
- Scripts get stable exit codes (`8` for npm, `130` for cancelled) and a stable JSON result.
- The prerelease fix also corrects the version-skew checks.
