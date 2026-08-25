# Issue: Refactor autoFixAllGithubParity_spec

## Description

`core/spec/bin/autoFixAllGithubParity_spec.js` has grown to 613 lines (26.8 KB) — nearly 2x the second-largest spec in `core/spec/bin/`. It tests shell-vs-native parity for 7 subcommands of the `auto-fix-all-github` entrypoint migrated in #265, across 8 `describe` blocks and 13 test cases. The complexity is real, but the file has clear bloat from repeated boilerplate.

## Problem

**1. Repeated setup/cleanup boilerplate.** 9 of 13 test cases repeat the same block:

```js
const fakeGh = await createFakeGhBin();
const shellRepo = await createGitFixtureRepo();
const nativeRepo = await createGitFixtureRepo();
try {
  await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);
  const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
  const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, { ghVars, fetchVars });
  const { shell, native } = await runBoth(...);
  expect(native.stdout).toEqual(shell.stdout);
  expect(native.code).toEqual(shell.code);
} finally {
  await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
}
```

This accounts for ~250 lines of near-identical code.

**2. Helpers inlined that belong in `core/spec/support/`.** Six functions (`runCommand`, `git`, `seedEnv`, `seedGithubLikeRepo`, `runBoth`, `buildDispatchFixtures`) live inside the spec file instead of in shared support modules.

**3. Mixed concerns.** The `engine_dispatch routing` describe block (~100 lines) tests dispatch routing (shell vs native mode), not output parity — a fundamentally different concern sitting alongside parity tests.

## Expected Behavior

Zero behavior change — same 13 tests, same assertions. Shell and native sides continue to produce byte-identical stdout and matching exit codes for every subcommand; only the test file layout and helper locations change.

## Solution

### 1. Split into per-subcommand spec files

Create subdirectory `core/spec/bin/autoFixAllGithubParity/` with one file per subcommand:

```
core/spec/bin/autoFixAllGithubParity/
├── pr_number_spec.js          (2 tests)
├── pr_state_spec.js           (1 test)
├── pr_merge_spec.js           (2 tests)
├── cleanup_branch_spec.js     (1 test)
├── has_shipit_label_spec.js   (2 tests)
├── add_tag_spec.js            (2 tests)
├── remove_tag_spec.js         (1 test)
└── engine_dispatch_spec.js    (2 tests — routing, not parity)
```

This establishes a **new convention**: specs with 400+ lines AND multiple contexts/methods under test should be split into subdirectories. The Jasmine glob (`bin/**/*_spec.js` in `jasmine.json`) already covers subdirectories — no config change needed.

### 2. Extract helpers to `core/spec/support/`

| Function(s) | Destination |
| --- | --- |
| `runCommand` + `git` + `runBoth` (+ `SHELL_SCRIPT`/`NATIVE_BIN`/`FAKE_FETCH_PRELOAD` constants) | `core/spec/support/utils/runCommand.js` |
| `seedEnv` | `core/spec/support/utils/parityEnv.js` |
| `setupParityTest` (new) + `seedGithubLikeRepo` + `expectParity` (new) | `core/spec/support/factories/githubParitySetup.js` |
| `buildDispatchFixtures` (+ `ENGINE_DISPATCH_SCRIPT` constant) | `core/spec/support/fixtures/engineDispatchFixtures.js` |

**Path depth note:** today's `REPO_ROOT`/`SHELL_SCRIPT`/`NATIVE_BIN`/`FAKE_FETCH_PRELOAD`/`ENGINE_DISPATCH_SCRIPT` constants are derived from `import.meta.url` with a fixed number of `'..'` hops back to the repo root. Centralizing them into the two support modules above (rather than duplicating the computation in each of the 8 split files) sidesteps the depth problem entirely: each support module computes its own `REPO_ROOT` relative to *its own* fixed location under `core/spec/support/`, which doesn't change regardless of how the spec files above it are organized. Split spec files import the constants/helpers instead of recomputing paths themselves.

### 3. Create `setupParityTest` factory

A single factory that orchestrates the repeated setup:

```js
const ctx = await setupParityTest({
  ghVars: { FAKE_GH_PR_NUMBER: '42' },
  fetchVars: { FAKE_FETCH_PR_NUMBER: '42' }
});
// returns { shellRepo, nativeRepo, shellEnv, nativeEnv, fakeGh, cleanup() }
```

### 4. Extract shared assertion

Lives alongside `setupParityTest` in `core/spec/support/factories/githubParitySetup.js` — every split file that imports the factory needs the assertion too:

```js
function expectParity(shell, native) {
  expect(native.stdout).toEqual(shell.stdout);
  expect(native.code).toEqual(shell.code);
}
```

### 5. Note on `cleanup_branch_spec.js`

This test cannot use `expectParity` directly — git SHAs differ between the two independent fixture repos (different commit timestamps → different SHAs), so it predicts each side's expected stdout from its own repo's SHAs. This logic stays inline in the split file.

### 6. Note on `engine_dispatch_spec.js`

This file tests **routing** (which engine runs given `engine.mode` config), not output parity. It has its own `buildDispatchFixtures` helper and does not use `setupParityTest` or `expectParity`. Kept in the same subdirectory since it covers the same `auto-fix-all-github` entrypoint.

### Scope Boundaries

**In scope:** only `core/spec/bin/autoFixAllGithubParity_spec.js` — the split, the new subdirectory, and the extracted `core/spec/support/` helpers described above.

**Out of scope:** `core/spec/bin/autoFixAllQueueParity_spec.js` (479 lines) already meets the new 400+ line convention this issue establishes, but is deliberately left untouched here to keep this issue's diff focused. Spun off as #289 (comment-only cross-reference, not a sub-issue — it's an independent follow-up, not part of this issue's own work breakdown), which should reuse whatever shared helpers land in `core/spec/support/` from this issue rather than duplicating them.

## Benefits

- No spec file exceeds ~150 lines
- Shared helpers in `core/spec/support/` follow existing conventions
- Establishes a new subdirectory convention for large multi-context specs, immediately reusable by #289's follow-up split of `autoFixAllQueueParity_spec.js`
