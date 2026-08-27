# Update AutoFixAllWaitCi_spec.js mocks

Keep testing at the same level the spec does today — stubbing `fetchFn`/`execFileAsync` and asserting on the resulting REST calls/stdout/exit code, mirroring `AutoFixAllGithub_spec.js`'s own convention of never mocking `PrOperations` directly. Since `run()` now goes through `_prOperations(repoPath)`/`_prChecker(repoPath)` instead of raw private methods, the REST call sequence and URLs stay identical (`GET /pulls/{prNumber}`, then `GET /commits/{sha}/check-runs`) — only the internal call path changed, so existing `fetchFn` stub assertions should need little to no adjustment. Confirm:

- `pollIntervalMs`/`sleepFn` stubs and their assertions are entirely unaffected.
- Stdout/exit-code assertions (`passed`, `failed\n<names>`) are unchanged.
- Any test that stubbed the now-removed private methods directly (`_resolvePrNumber`, `_pollOnce`, etc., if any did) is rewritten to stub at the `fetchFn` boundary instead.

Finally, run `core/spec/bin/autoFixAllWaitCiParity_spec.js` (shell vs. native parity) and confirm it's still green — this is the final acceptance check for the whole refactor.

## Files to Change

- `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` — update mocks/assertions for the new call path; no behavioral changes expected.
