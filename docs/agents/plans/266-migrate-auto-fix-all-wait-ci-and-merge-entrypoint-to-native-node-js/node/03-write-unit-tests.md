# Write native unit tests

Write `core/spec/lib/AutoFixAllWaitCiAndMerge_spec.js`, following the mocked-collaborator style already used in `core/spec/lib/AutoFixAllWaitCi_spec.js` / `AutoFixAllGithub_spec.js` (inject fake `waitCi`/`github` objects rather than hitting the real network).

Cover:

- CI passed → merge succeeds: `waitCi.run` resolves `'passed\n'`, `github.prMerge` resolves `'<url>\n'`; assert `run()` resolves `'passed\n<url>\n'` and that `prMerge` was called with `(repoPath, modelEmail)`.
- CI failed: `waitCi.run` resolves `'failed\nsome-check\n'`; assert `run()` resolves that string unchanged and `github.prMerge` was **not** called.
- Missing `repoPath`: assert `run()` rejects with the usage `Error`.
- `waitCi.run` throws: assert the error propagates unchanged and `github.prMerge` is not called.
- `github.prMerge` throws (CI passed but merge fails): assert the error propagates unchanged.
- `modelEmail` omitted: assert it's still forwarded as `undefined`/absent to `prMerge`, matching the shell script's optional second positional arg.

## Files to Change

- `core/spec/lib/AutoFixAllWaitCiAndMerge_spec.js` — new file, unit tests for `AutoFixAllWaitCiAndMerge`.
