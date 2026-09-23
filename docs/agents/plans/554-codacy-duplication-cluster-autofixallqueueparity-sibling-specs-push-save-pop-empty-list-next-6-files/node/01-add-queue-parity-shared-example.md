# Add the queue parity shared example
Create `core/spec/support/sharedExamples/queueParitySharedExamples.js` and export:

```js
itMatchesShellForQueueOp(description, {
  op,              // keyof SHELL_SCRIPTS, e.g. 'push'
  seed,            // string[] | undefined — when undefined, no queue file is written (next's absent-file case)
  args = [],       // args after <repo_path>
  github = false,  // true → setupParityTest() fixtures + fake gh PATH; false → two createTempDir() dirs
  env = {},        // extra env (FAKE_GH_* / FAKE_FETCH_*); PATH with fakeGh.binDir is prepended automatically when github
  fakeFetch = false,
  expectedCode,    // number, or the exported NON_ZERO marker → expect(code).not.toEqual(0)
  expectedStdout,
  followUp         // optional { op, args = [], expectedStdout } — runs a second runPair on the same fixtures;
                   // asserts shell stdout === expectedStdout and native stdout === shell stdout
})
```

It registers a single `it(description, async () => { … })`. Fixture creation, seeding both sides, `runPair`, `expectParity`, and the code/stdout/follow-up assertions happen inside it, with cleanup in `finally`.

To keep the helper simple, add a small `setupTempDirPair()` factory to `queueParitySetup.js` that returns `{ shellRepoPath, nativeRepoPath, cleanup }`, using `createTempDir('arcanum-core-afaq-parity-shell-')` / `createTempDir('arcanum-core-afaq-parity-native-')` and `removeTempDir`. Normalize the github setup to the same `{ shellRepoPath, nativeRepoPath, cleanup }` shape inside the shared example, and keep `setupParityTest` itself unchanged.

Document the exported function and every option with JSDoc, following `engineDispatchRouting.js`.

## Files to Change
- `core/spec/support/sharedExamples/queueParitySharedExamples.js` — new; exports `itMatchesShellForQueueOp` and `NON_ZERO`.
- `core/spec/support/factories/queueParitySetup.js` — add `setupTempDirPair()`.
