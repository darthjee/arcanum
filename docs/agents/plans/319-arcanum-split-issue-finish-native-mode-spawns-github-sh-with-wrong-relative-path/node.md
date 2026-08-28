# node Plan: arcanum-split-issue finish (native mode) spawns github.sh with wrong relative path

Main plan: [plan.md](plan.md)

## Overview

Under `engine.mode: "native"`, `/arcanum-split-issue`'s finish step dispatches to `core/bin/arcanum arcanum-split-issue-finish`, which runs `core/lib/commands/ArcanumSplitIssueFinish.js`. Its `run()` builds the `github.sh` path as `path.join(this._repoContext.repoPath, 'arcanum-split-issue', 'scripts', 'github.sh')` — rooted at the *target* repo, where that file does not exist — so `execFileAsync` throws `spawn … ENOENT`.

The sibling module `core/lib/commands/AutoFixAllReplyComment.js` (lines 13-21) already solves the identical problem: it resolves a sibling skill's script from the module's own directory (`MODULE_DIR`, three levels up from `core/lib/commands/` to the install root). This plan applies the same pattern here and fixes the two specs that currently bake in the wrong assumption.

## Context

- `finish_shell.sh` (the shell implementation) is already correct — it calls `"${SCRIPT_DIR}/github.sh"`, always the real install — and is out of scope.
- `repoPath` must still be passed **as an argument** to `github.sh` (`['mark-split', repoPath, issueId]`); only the resolved executable path changes.
- Audit (in the issue) confirms `ArcanumSplitIssueFinish.js` is the only native module with this bug. `ArcanumUpdateRunUpdate.js` also joins on `repoPath` but there `repoPath` *is* the arcanum install dir by design.
- `github.sh mark-split` has never actually executed in native mode (the ENOENT always aborted first). After the fix it runs under `engine_dispatch`'s stripped `env -i` (only `PATH`, `ARCANUM_REPO_PATH`, and `finish.sh`'s allowlisted `HOME`). `gh` auth via `HOME`/`~/.config/gh` works; `GH_TOKEN`/`GITHUB_TOKEN` are not forwarded. Do **not** change the allowlist as part of this issue — only note it if end-to-end verification reveals an auth gap.
- `cmd_mark_split` in `arcanum/_lib/github_issue_shell.sh` takes `repo_path` explicitly and does not `cd`, so the `execFileAsync` call correctly needs no `cwd` option.
- Extracting a shared install-root helper is explicitly deferred to issue #325 — use the same inline `MODULE_DIR, '..', '..', '..'` pattern as the `AutoFixAllReplyComment.js` precedent.

## Implementation Steps

### Step 1 — Resolve `github.sh` from the module directory

In `core/lib/commands/ArcanumSplitIssueFinish.js`:

1. Add `import { fileURLToPath } from 'node:url';` alongside the existing imports.
2. Add module-level constants after the existing `USAGE` / `ISSUES_DIR` constants, mirroring `AutoFixAllReplyComment.js`:

   ```js
   const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
   // `arcanum-split-issue/scripts/github.sh` is shelled out to exactly
   // like `finish_shell.sh` does — resolved relative to this skill repo's
   // own root (three levels up from `core/lib/commands/`), NOT the target
   // `repoPath` being operated on.
   const GITHUB_SCRIPT = path.join(
     MODULE_DIR, '..', '..', '..', 'arcanum-split-issue', 'scripts', 'github.sh'
   );
   ```
3. In `run()`, replace the first argument to `this._execFileAsync(...)` — currently
   `path.join(this._repoContext.repoPath, 'arcanum-split-issue', 'scripts', 'github.sh')` — with `GITHUB_SCRIPT`. Leave the argument array `['mark-split', this._repoContext.repoPath, issueId]` untouched.
4. Update the `run()` JSDoc line that says it shells out to `arcanum-split-issue/scripts/github.sh` only if it currently implies a `repoPath`-relative location; keep it accurate to "resolved from this module's directory".

### Step 2 — Stop the specs from encoding the bug

1. `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` — in the `'invokes execFileAsync with the script path and array args'` test (~L77-80), the first `toHaveBeenCalledWith` argument is `path.join(repoPath, 'arcanum-split-issue', 'scripts', 'github.sh')`. Replace it with a path-location-independent matcher, following the sibling precedent `AutoFixAllReplyComment_spec.js:216` (`jasmine.stringMatching(/resolve_pr_number\.sh$/)`):

   ```js
   expect(deps.execFileAsync).toHaveBeenCalledWith(
     jasmine.stringMatching(/arcanum-split-issue[/\\]scripts[/\\]github\.sh$/),
     ['mark-split', repoPath, ISSUE_ID]
   );
   ```

   (An exact `path.join` assertion computed from the spec file's own `import.meta.url` three levels up is an acceptable alternative, but the `stringMatching` form matches the existing convention and is less brittle.) Keep the `['mark-split', repoPath, ISSUE_ID]` arg-array assertion exactly as is — that still verifies `repoPath` is forwarded as an argument.

2. `core/spec/bin/arcanumSplitIssueFinishParity_spec.js`:
   - In `createFinishFixtureRepo()` (~L83-94), remove the `cp` of `arcanum-split-issue/` into the fixture repo. The `cp` of `arcanum/` is also now unnecessary (the native module always uses the real install) — remove it too, so the function reduces to `return createGitFixtureRepo();`. At that point the `'mark-split failing before the cleanup step'` case (~L171-202) can call `createGitFixtureRepo()` directly and `createFinishFixtureRepo` can be deleted, or `createFinishFixtureRepo` can be kept as a thin alias — collapse to whichever reads cleaner, matching the other cases in the file that already use `createGitFixtureRepo()`.
   - Rewrite the header comment (~L72-80, and any inline comment that repeats it) so it states the native module resolves `github.sh` from **its own module directory** (like `finish_shell.sh`'s `"${SCRIPT_DIR}/github.sh"`), and that the offline-`origin` fixture alone is what drives `github.sh mark-split` to fail at `arcanum/_lib/origin.sh`'s `_load_origin` ("unrecognized origin format"), deterministically and offline — the skill-dir copy is no longer part of the mechanism.
   - Leave every assertion (byte-identical stdout, exit code, `Error: unrecognized origin format:` on stderr, working file left untouched) unchanged — they must still pass, now against a fixture that no longer carries a copy of the skill tree.

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

Run both from `core/`. `core/spec/bin/arcanumSplitIssueFinishParity_spec.js` executes the real `finish_shell.sh` and `core/bin/arcanum` against a local offline-origin git fixture (no network), so it exercises the fixed path end-to-end within the deterministic offline failure path.

## Notes

- The unit spec's mocked `execFileAsync` cannot catch an `env`/`cwd` regression — the parity spec is the one that actually spawns `github.sh`. Both must be green.
- No change to `finish_shell.sh`, `engine_dispatch.sh`, `finish.sh`'s env allowlist, or `migration-status.json`.
- Optional (nice-to-have, not required): add a positive assertion — unit or parity — that the resolved script path ends in `arcanum-split-issue/scripts/github.sh` **and** exists on disk, so a future regression to a `repoPath`-rooted path fails loudly rather than only surfacing at runtime.
- Backward compatibility: `engine.mode: shell`/`docker` are unaffected (they run `finish_shell.sh`); `native` is currently fully broken, so there is no working behavior to regress. The `Deleted:` / `BRANCH=` stdout + exit-code contract is unchanged.
