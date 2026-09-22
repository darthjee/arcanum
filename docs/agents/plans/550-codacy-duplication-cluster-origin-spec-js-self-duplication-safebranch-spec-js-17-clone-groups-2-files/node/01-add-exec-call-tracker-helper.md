# Add a shared execFileAsync call-tracking spec helper

`Origin_spec.js`'s `repoPath`-fallback/override tests and `SafeBranch_spec.js`'s "fetches and checks out the configured safe branch" test each hand-roll the same fragment:

```js
const calls = [];
const execFileSpy = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
  calls.push(args);
  return Promise.resolve({ stdout: '...', stderr: '' });
});
```

Extract this into a new spec support helper, following the existing convention in `core/spec/support/utils/` (see `gitFixtureRepo.js`/`tempDir.js` for the JSDoc + named-export shape). Suggested shape — adjust names/signature as needed to fit both call sites cleanly:

```js
// core/spec/support/utils/execCallTracker.js

/**
 * Build a jasmine spy standing in for `execFileAsync` that records every
 * call's `args` and resolves with a fixed `{ stdout, stderr }`, for specs
 * that only need to assert *which* git commands were invoked.
 * @param {string} [stdout] - the stubbed stdout for every call.
 * @returns {{ execFileAsync: jasmine.Spy, calls: Array<string[]> }} the spy and its recorded call args.
 */
export function trackedExecFileAsync(stdout = '') {
  const calls = [];
  const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
    calls.push(args);
    return Promise.resolve({ stdout, stderr: '' });
  });

  return { execFileAsync, calls };
}
```

Do not wire it into either spec file yet — that happens in steps 02 and 03. This step only adds the helper module itself.

## Files to Change

- `core/spec/support/utils/execCallTracker.js` (new) — the shared `execFileAsync`-tracking spy helper described above.
