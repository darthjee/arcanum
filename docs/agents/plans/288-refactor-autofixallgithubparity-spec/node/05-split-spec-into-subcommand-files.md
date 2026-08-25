# Split the spec into per-subcommand files

Create `core/spec/bin/autoFixAllGithubParity/` and move each `describe` block out of `core/spec/bin/autoFixAllGithubParity_spec.js` into its own file, per the issue's mapping:

| New file | Source `describe` block (current line range) | Tests |
| --- | --- | --- |
| `pr_number_spec.js` | `pr-number` (150–202) | 2 |
| `pr_state_spec.js` | `pr-state` (203–231) | 1 |
| `pr_merge_spec.js` | `pr-merge` (232–285) | 2 |
| `cleanup_branch_spec.js` | `cleanup-branch` (286–349) | 1 |
| `has_shipit_label_spec.js` | `has-shipit-label` (350–405) | 2 |
| `add_tag_spec.js` | `add-tag` (406–456) | 2 |
| `remove_tag_spec.js` | `remove-tag` (457–524) | 1 |
| `engine_dispatch_spec.js` | `engine_dispatch routing` (525–613) | 2 |

For each of the 7 parity files (all but `engine_dispatch_spec.js`):
- Import `setupParityTest`, `expectParity` from `../../support/factories/githubParitySetup.js` (three `'..'` — the new file sits one directory deeper than today's `core/spec/bin/`).
- Import `runBoth`, `SHELL_SCRIPT`, `NATIVE_BIN` from `../../support/utils/runCommand.js` as needed.
- Replace each test's repeated setup/`finally` block (issue's Problem section, item 1) with `const ctx = await setupParityTest({ ghVars, fetchVars }); try { ... } finally { await ctx.cleanup(); }`, and each `expect(native.stdout).toEqual(shell.stdout); expect(native.code).toEqual(shell.code);` pair with `expectParity(shell, native)`.
- Keep each subcommand's specific `ghVars`/`fetchVars`/assertions unchanged — this is a mechanical move, not a behavior change.

`cleanup_branch_spec.js` is the one exception: it does **not** use `setupParityTest`/`expectParity` (see step 03's note and the issue's "Note on `cleanup_branch_spec.js`") — move its body as-is, importing `createGitFixtureRepo` directly from `../../support/utils/gitFixtureRepo.js` and `runCommand`/`git`/`SHELL_SCRIPT`/`NATIVE_BIN` from `../../support/utils/runCommand.js`. Its own-SHA-prediction logic stays inline, unchanged.

`engine_dispatch_spec.js` imports `runCommand`, `createTempDir`/`removeTempDir` from their existing/extracted homes, plus `buildDispatchFixtures`/`ENGINE_DISPATCH_SCRIPT` from `../../support/fixtures/engineDispatchFixtures.js` (step 04). Keep `seedEngineMode` inline (per step 04's note). It uses neither `setupParityTest` nor `expectParity`.

Each new file needs its own top-of-file comment summarizing what it covers (adapted from the original spec's header comment, lines 10–38), scoped to that one subcommand — don't copy the full multi-paragraph header into all 8 files verbatim.

Once all 8 files exist and pass, delete the original `core/spec/bin/autoFixAllGithubParity_spec.js`.

**Verify** (zero-behavior-change acceptance bar from the issue):
- `cd core && yarn test` — confirm all 13 tests still run and pass (11 parity + 2 routing, same as today), and that `c8`'s coverage run and Jasmine's `bin/**/*_spec.js` glob pick up the new subdirectory with no config change.
- `cd core && yarn lint` — confirm the 8 new files and 4 new support files pass eslint.

## Files to Change

- `core/spec/bin/autoFixAllGithubParity/pr_number_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity/pr_state_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity/pr_merge_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity/cleanup_branch_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity/has_shipit_label_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity/add_tag_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity/remove_tag_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js` — new
- `core/spec/bin/autoFixAllGithubParity_spec.js` — deleted, now fully replaced by the 8 files above
