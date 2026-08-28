# Issue: arcanum-split-issue finish (native mode) spawns github.sh with wrong relative path

## Description

Under global config `engine.mode: "native"`, running `/arcanum-split-issue` through to its finish step (`arcanum-split-issue/scripts/finish.sh <repo_path> <id>`) fails with:

```
arcanum: spawn /Users/darthjee/projetos/orca/tingle/arcanum-split-issue/scripts/github.sh ENOENT
```

The native binary (`core/bin/arcanum`, command `arcanum-split-issue-finish`) resolves `arcanum-split-issue/scripts/github.sh` relative to `ARCANUM_REPO_PATH` (the *target* repo being operated on) instead of relative to the arcanum skills install directory where `github.sh` actually lives.

**Repro**

1. Set `engine.mode: "native"` in the global arcanum config (e.g. `~/.claude-syngenta/arcanum-config.json`).
2. Run `/arcanum-split-issue` on any GitHub issue, through to the finish step (after all sub-issues are pushed).
3. The `arcanum-split-issue-finish` native call fails with the ENOENT above.

**Workaround used**

Called `arcanum-split-issue/scripts/finish_shell.sh <repo_path> <id>` directly, bypassing `engine_dispatch`. That completed successfully — relabeled the parent issue `Planning` -> `Split`, deleted the local working files, and checked the working tree out to the configured safe branch.

Reproduced against `darthjee/tingle`, issue #19 (split into #20-#24).

## Problem

`core/lib/commands/ArcanumSplitIssueFinish.js` (`run()`, currently lines 72-75) builds the script path as:

```js
path.join(this._repoContext.repoPath, 'arcanum-split-issue', 'scripts', 'github.sh')
```

rooted at the **target repo**, not at the **arcanum skills install directory** where `arcanum-split-issue/scripts/github.sh` actually lives. Under `engine.mode: "native"` the shim (`arcanum-split-issue/scripts/finish.sh`) dispatches to `core/bin/arcanum arcanum-split-issue-finish`, which runs this module and spawns the non-existent path -> `ENOENT`.

The sibling native module `core/lib/commands/AutoFixAllReplyComment.js` (lines 13-21) already handles the identical situation correctly: it resolves a sibling skill's script relative to the module's own directory, three levels up from `core/lib/commands/` to the install root.

**Two specs currently mask the defect**

- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` (~L77-79) asserts `execFileAsync` is called with `path.join(repoPath, 'arcanum-split-issue', 'scripts', 'github.sh')` — i.e. it encodes the wrong path.
- `core/spec/bin/arcanumSplitIssueFinishParity_spec.js` — `createFinishFixtureRepo()` (L83-94) `cp`s both `arcanum/` and `arcanum-split-issue/` into the fixture repo, and its header comment (L72-80) describes the native module as resolving `github.sh` "relative to `repoPath`". This manufactures a copy of the skill dir inside the target repo so the buggy path resolves to a real file, letting the native side reach `_load_origin` and fail there as the test expects. `finish_shell.sh` never needed that copy — it calls `"${SCRIPT_DIR}/github.sh"`, always the real install.

**Audit — is the same bug elsewhere?**

Swept every `core/lib/**/*.js` module for script paths rooted at `repoPath`. `ArcanumSplitIssueFinish.js:73` is the only occurrence.

- Only two native modules shell out to arcanum's *own* sibling skill scripts: `ArcanumSplitIssueFinish` (buggy) and `AutoFixAllReplyComment` (correct).
- `ArcanumUpdateRunUpdate.js:74,102` also does `path.join(repoPath, 'arcanum', 'update', 'bootstrap.sh')`, but there `repoPath` is explicitly "the arcanum install's own self-resolved location, not the caller's `REPO_PATH`" — correct as-is.
- All other `path.join(repoPath, ...)` uses are legitimately target-repo-relative (`docs/agents/issues/...`, `.claude/...` config).

## Expected Behavior

Under `engine.mode: "native"`, the finish step resolves `github.sh` from the arcanum install directory and completes exactly as `finish_shell.sh` does — relabels the parent issue `Planning` -> `Split`, deletes the local `docs/agents/issues/<id>-*` / `<id>_*` working files, and releases the working tree back to the configured safe branch — preserving the same `Deleted:` / `BRANCH=` stdout and exit-code contract.

## Solution

In `core/lib/commands/ArcanumSplitIssueFinish.js`, mirror `AutoFixAllReplyComment.js`'s pattern:

```js
import { fileURLToPath } from 'node:url';
// ...
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
// `arcanum-split-issue/scripts/github.sh` is shelled out to exactly like
// `finish_shell.sh` does — resolved relative to this skill repo's own
// root (three levels up from `core/lib/commands/`), NOT the target
// `repoPath` being operated on.
const GITHUB_SCRIPT = path.join(
  MODULE_DIR, '..', '..', '..', 'arcanum-split-issue', 'scripts', 'github.sh'
);
```

`run()` passes `GITHUB_SCRIPT` to `execFileAsync` instead of the `path.join(this._repoContext.repoPath, ...)` expression. The argument array `['mark-split', this._repoContext.repoPath, issueId]` is unchanged — `repoPath` is still correctly forwarded *as an argument* to `github.sh`.

**Test changes**

1. `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` (~L77-79) — update the `execFileAsync` path assertion to the install-root-relative path (computed the same way the module computes it), so it would fail against the buggy code.
2. `core/spec/bin/arcanumSplitIssueFinishParity_spec.js` — drop the `arcanum-split-issue/` fixture copy (and the now-needless `arcanum/` copy — the real install is always used) so the "mark-split failing before cleanup" case runs against a plain `createGitFixtureRepo()` like every other case in the file; rewrite the L72-80 comment to state the native module resolves `github.sh` from its own module dir, matching the shell side. After the fix the offline-origin fixture alone drives `_load_origin` to fail.
3. Optionally add a positive assertion (unit or parity) that the resolved script path is `<install-root>/arcanum-split-issue/scripts/github.sh` and exists on disk, so a future regression to a `repoPath`-rooted path fails loudly.

**Scope**

In scope: `ArcanumSplitIssueFinish.js` + its two specs.

Out of scope:

- `finish_shell.sh` / any shell path — already correct.
- `AutoFixAllReplyComment.js` — already correct; not touched here.
- `engine_dispatch.sh` and the wider script engine.
- The `env -i` / `HOME` allowlist mechanism — verified only, not changed.
- Re-running the `darthjee/tingle` split.
- Extracting a shared "arcanum install root" helper so `ArcanumSplitIssueFinish` and `AutoFixAllReplyComment` stop repeating `MODULE_DIR, '..', '..', '..'` — split off as **#325**. This issue uses the same inline `../../../` pattern as the existing `AutoFixAllReplyComment` precedent.

**Edge cases to verify (not change)**

The ENOENT always aborted at the `spawn` of `github.sh` itself, so `github.sh mark-split` has never actually executed in native mode. Fixing the path makes this the first real run under `engine_dispatch`'s `env -i` invocation:

- **`gh` under the stripped env.** `execFile(GITHUB_SCRIPT, ...)` inherits the native process's environment, reduced by `engine_dispatch` to `PATH`, `ARCANUM_REPO_PATH` and the `finish.sh` allowlist's `HOME`. `cmd_mark_split` -> `tag_mutate_add_label`/`remove_label` shell out to `gh`, which needs `PATH` (present) and auth via `HOME`/`~/.config/gh` (present) — but **not** `GH_TOKEN`/`GITHUB_TOKEN`, which are not forwarded. Pre-existing property of every HOME-only migrated entrypoint; add a token var to `finish.sh`'s allowlist only if the verification environment authenticates `gh` that way.
- **cwd independence.** `cmd_mark_split` does not call `repo_path_enter` (unlike `fetch`/`create`) — it takes `repo_path` explicitly and `_load_origin "$repo_path"` uses that arg. So the native module is correct to invoke `execFile` without `cwd: repoPath`. Confirm no bare `git` without `-C` sits on the `mark-split` path.
- **`github.sh`'s own lib resolution.** `github.sh` -> `arcanum/_lib/github_issue.sh` resolves `repo_path.sh`, `origin.sh`, `tag_mutations.sh` etc. via its own `SCRIPT_DIR`; once `GITHUB_SCRIPT` points at the real install these resolve correctly.
- **Verification must run the real flow.** The unit spec's mocked `execFileAsync` cannot catch an env/cwd regression — verification needs a real end-to-end `finish` against a throwaway GitHub issue, or the parity spec's deterministic offline `_load_origin` failure path.

**Backward compatibility** — no risk. `engine.mode: shell` (default) and `docker` fall through to `finish_shell.sh` (untouched); `engine.mode: native` is currently fully broken, so there is no working behavior to regress; the `Deleted:` / `BRANCH=` stdout and exit-code contract is unchanged; no config, state-file, or on-disk format change; the parity-spec edit is test-only.

**Not applicable** — no repo-facing config/file-shape change (no `arcanum/migrations/repos/<version>/` script); no new interactive prompt; no new root-level folder.

## Benefits

- `engine.mode: "native"` users can run `/arcanum-split-issue` through to completion without falling back to the `finish_shell.sh` workaround.
- Removes a latent trap for future entrypoint migrations: the parity spec starts genuinely validating install-relative script resolution instead of masking a `repoPath`-rooted path with a fixture copy.
