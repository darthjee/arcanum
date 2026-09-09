# Issue: Extend ClaudeContext to carry the runtime-validated arcanum install root

## Description

`ClaudeContext` (`core/lib/context/ClaudeContext.js`, added in #321) is a peer to
`RepoContext`. Today its sole job is anchoring Claude Code's native **settings-file** path
building — `localSettingsPath()`, `projectSettingsPath()`, `globalSettingsPath()` — off a
caller-supplied `<anchor>` (the `repoPath` key) plus `CLAUDE_CONFIG_DIR` / `HOME` read from
an injectable `env`. It wraps none of `RepoContext`'s collaborators, every method is pure
string building (no `fs`), and it is wired to exactly one command: `permission-grant-add`
(`context: 'claude'` in `core/lib/core/commands.js`).

Separately, the arcanum **install root** — the checkout/zip tree that ships
`arcanum/update/bootstrap.sh`, `arcanum.json`, `arcanum/_lib/*.sh` and `core/` — is
self-resolved, from the running files' own location, in two independent places:

- shell: `arcanum-update/scripts/run_update.sh` computes
  `TARGET_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"` from `BASH_SOURCE`;
- JS: `core/lib/utils/file/InstallRoot.js` exports `INSTALL_ROOT`
  (`path.dirname(fileURLToPath(import.meta.url))` + four `..`), added in #325 for exactly
  this "resolve the install, never the target repo" need (which #319 got wrong).

For a well-formed install these two derivations resolve to the **same physical directory**.
`ArcanumUpdateRunUpdate` (`arcanum-update-run-update-check` / `-apply`) receives
`TARGET_PATH` purely as a positional method argument and never cross-checks it.

## Problem

The companion migration (#420 — "Migrate ArcanumUpdateRunUpdate to a constructor-injected
ClaudeContext") wants the install root delivered as a constructor-bound `context: 'claude'`
collaborator rather than a positional method argument. That needs a `ClaudeContext` that:

1. exposes the install root and the install's key paths, and
2. can assert the anchor it was handed **is** the arcanum install this runtime is executing
   from — i.e. the path the shell resolved (`BASH_SOURCE` walk) equals the path Node
   resolved (`import.meta.url` walk) — so a malformed / partial install, an unsanctioned
   direct `core/bin/arcanum … <path>` call, or a future regression to passing the
   *target-repo* path (the #319 class) is caught rather than acted on.

`ClaudeContext` is the natural home — it already models "this Claude install's"
settings/config anchoring — but it currently knows nothing about the arcanum install.

An earlier framing of this issue proposed validating the install against
`CLAUDE_CONFIG_DIR`. That is **rejected**: arcanum's install location is never derived from
`CLAUDE_CONFIG_DIR` — `arcanum/install/installer.sh` defaults to a hardcoded
`$HOME/.claude/skills` and also allows `.` (cwd) or a custom path, and project-level
`.claude/skills` installs exist too — so a config-dir prefix check produces false negatives
for perfectly valid installs. The sound invariant is `realpath(anchor) === INSTALL_ROOT`.
The real drift risk is also narrower than first assumed: in the sanctioned flow every path
is anchored to the running files' own location, so `/arcanum-update` from one Claude config
cannot resolve to another config's install; the guard is defense-in-depth against the three
cases listed above.

## Solution

Extend `ClaudeContext` in place, fully backward compatible for `permission-grant-add`.

- Keep the constructor shape `constructor({ repoPath, env = process.env } = {})`;
  `repoPath` stays the `<anchor>`.
- Add pure string-building accessors (no `fs`, matching the class's current contract):
  - `installRoot()` — the anchor, normalized, treated as the arcanum install root.
  - `bootstrapPath()` — `<installRoot>/arcanum/update/bootstrap.sh`
  - `arcanumJsonPath()` — `<installRoot>/arcanum.json`
  - `gitDirPath()` — `<installRoot>/.git`
  - `configDir()` — `CLAUDE_CONFIG_DIR || $HOME/.claude`; re-express the existing
    `globalSettingsPath()` in terms of it. **Not consulted by `validateInstall()`** — kept
    only to de-duplicate that string.
- Add one lazy `fs` validator `validateInstall()` — mirrors `RepoContext#validate()` (the
  single `fs`-touching method there; never runs from the constructor). Two independent
  assertions:
  - **Structural marker check** — centralizes what `ArcanumUpdateRunUpdate._resolveTarget`
    does today (`core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js:101-125`):
    `bootstrapPath()` exists **and** (`arcanumJsonPath()` exists **or** `gitDirPath()`
    exists). On failure, throw the existing `DispatchFailure('STATUS=missing_arcanum\n', 1)`
    contract.
  - **Anti-drift identity check** — `fs.realpathSync(installRoot()) === INSTALL_ROOT`
    (apply `realpathSync` to `INSTALL_ROOT` too, so an anchor with an unresolved symlink
    segment still matches). On mismatch, throw a distinct, explicit error, e.g.
    `arcanum install at <anchor> is not the running arcanum install (<INSTALL_ROOT>)`.
- This adds a `core/lib/context/` → `core/lib/utils/file/InstallRoot.js` import;
  `RepoContext` already imports from `utils/`, so it stays within the existing layering
  boundary (the #393 lint guardrail).
- Update the class JSDoc: it now has one lazy `fs` validator — document it the way
  `RepoContext` documents `validate()`.

### Spec

- `core/spec/lib/context/ClaudeContext_spec.js`: cover the new accessors and
  `validateInstall()`'s three paths — happy (anchor === `INSTALL_ROOT`, markers present),
  missing-arcanum (markers absent → `STATUS=missing_arcanum` / exit 1), and identity
  mismatch (anchor ≠ `INSTALL_ROOT` → the distinct error) — using an injected `env` and a
  temp directory. Leave the existing settings-path cases untouched.

### Done when

- `ClaudeContext` exposes `installRoot()`, `bootstrapPath()`, `arcanumJsonPath()`,
  `gitDirPath()`, `configDir()`, and a lazy `validateInstall()` with the structural +
  identity assertions above.
- `globalSettingsPath()` is re-expressed via `configDir()` with no behaviour change.
- `permission-grant-add` / `PermissionGrant` behaviour is unchanged and its spec is
  untouched.
- `make core-test` passes; `make core-lint` is clean (including the layering guardrail).

### Out of scope

- Any change to `ArcanumUpdateRunUpdate`, `core/lib/core/dispatcher.js`, or
  `core/lib/core/commands.js` — that is #420.
- A shell mirror of `validateInstall()` — the shell engine path keeps its current
  `run_update_common.sh` `resolve_target` checks; revisit only if shell-parity tests
  demand it.
- Any `CLAUDE_CONFIG_DIR`-based install validation — explicitly rejected (see Problem).

## Benefits

- One place that both exposes the arcanum install's paths and asserts "the anchor I was
  handed is the install I'm running from", reusable by any future install-scoped native
  command.
- Turns the two already-existing but never-compared install-root resolutions (shell
  `BASH_SOURCE`, JS `import.meta.url`) into a checked invariant — catching malformed
  installs and #319-class regressions instead of silently acting on the wrong tree.
- Removes the "category mismatch" objection recorded in #324 (a *target-repo* `RepoContext`
  is the wrong abstraction for the arcanum install) — a self-validating `ClaudeContext` is
  the right one.
