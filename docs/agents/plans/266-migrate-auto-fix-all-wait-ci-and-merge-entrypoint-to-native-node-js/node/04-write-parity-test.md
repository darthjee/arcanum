# Write the shell/native parity test

Write `core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js`, following the same shape as `core/spec/bin/autoFixAllWaitCiParity_spec.js`: run `auto-fix-all/scripts/wait_ci_and_merge_shell.sh` (invoked directly, **not** through the `wait_ci_and_merge.sh` `engine_dispatch` shim — non-circular, same convention as the sibling parity specs) and `core/bin/arcanum auto-fix-all-wait-ci-and-merge` against equivalent inputs, asserting byte-identical stdout and exit code.

Since this entrypoint composes two already-migrated calls, both sides of every scenario need the same network-free fakes their own parity specs already established:

- `createFakeGhBin` (from `../support/utils/fakeGhBin.js`) for `gh pr view`/`gh api`/`gh auth token`, matching `autoFixAllWaitCiParity_spec.js` and `autoFixAllGithubParity_spec.js`.
- `fakeGithubApiFetchPreload.js`, `node --import`-preloaded, for the native side's raw `fetch` calls — check whether it needs a new mode covering both the CI-check-runs endpoint and the merge endpoint together, or whether the existing `wait-ci`/`pr-merge` modes can be composed for one fixture run.
- A `github.com`-shaped `origin` remote via `createGitFixtureRepo`, same as the sibling specs.

Cover:

- CI passes, merge succeeds: both sides print `passed\n<url>\n`, exit 0.
- CI fails: both sides print `failed\n<name>\n...` unchanged, exit 0, and (for the native side, via mock/spy or absence of a merge-fixture expectation) no merge attempt is made.
- A dedicated "engine_dispatch routing" section at the bottom (mirroring `autoFixAllWaitCiParity_spec.js`'s own) exercises the actual `wait_ci_and_merge.sh` shim itself for both `engine.mode=shell` and `engine.mode=native`, proving the shim selects the intended implementation.

## Files to Change

- `core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js` — new file, shell/native parity test.
