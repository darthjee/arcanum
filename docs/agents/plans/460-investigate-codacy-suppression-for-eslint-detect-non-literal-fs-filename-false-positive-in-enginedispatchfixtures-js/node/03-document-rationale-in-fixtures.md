# Document the rationale in representative fixture files

Add a short comment above the `writeFile` calls in `core/spec/support/fixtures/engineDispatchFixtures.js` (lines 22 and 36) explaining that `dir` is always a trusted, test-controlled temporary directory, never user/external input — so a future contributor understands why the Codacy `detect-non-literal-fs-filename` finding here is a false positive and doesn't try to "fix" it by hardcoding paths or removing the Codacy-side ignore.

Add the equivalent comment to 2–3 other representative occurrences of the same pattern (e.g. `core/spec/support/utils/gitFixtureRepo.js` and one factory under `core/spec/support/factories/`), rather than every occurrence repo-wide — the Codacy-side pattern ignore from Step 2 is what actually suppresses the noise; these comments are only for human readers.

## Files to Change

- `core/spec/support/fixtures/engineDispatchFixtures.js` — add a comment above the `writeFile` calls explaining `dir` is always trusted test setup.
- `core/spec/support/utils/gitFixtureRepo.js` — same comment above its `writeFile(path.join(seedPath, ...), ...)` call.
- One representative file under `core/spec/support/factories/` with the same `writeFile(path.join(<trusted-dir>, ...), ...)` shape — same comment.
