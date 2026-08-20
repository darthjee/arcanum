# Unit tests

Jasmine specs under `core/spec/`, mirroring `core/lib/`'s Step 01 module layout 1:1, with `fetch` mocked/stubbed via fixture data under `core/spec/support/fixtures/` (no real GitHub network calls in CI). Cover every branch called out in Step 01 and in the issue's Edge Cases:

- Malformed/empty/non-numeric/id-with-title input → `STATUS=error` with the exact message.
- Existing-file match → `STATUS=ok`, `TITLE` via `title_from_filename`, no fetch call made.
- Fresh fetch success → `STATUS=ok`, `TITLE` from the API fixture, `FILE` via `normalize_title`, labels mapped to tags, state file written with the lock protocol observed (e.g. lock file created then removed).
- `gh auth token` failure → `STATUS=error` with the exact auth-failure message.
- Fetch failure (mocked non-2xx/network error) → `STATUS=error` with the exact fetch-failure message.
- Fetch timeout → confirm the 30-second `AbortSignal.timeout` actually aborts (can use a short override in the test rather than waiting 30s for real).
- Filename sanitization: a title with symbols/uppercase/unicode produces the same slug `normalize_title` would.
- State-file lock contention: two near-simultaneous writes to the same `issue-<id>.json` don't corrupt each other (a directly-testable unit for the lock/mutate/release sequence, independent of the parity test).

## Files to Change

- `core/spec/` (new files, mirroring Step 01's `core/lib/` layout) — the specs described above.
- `core/spec/support/fixtures/` (new fixture files) — mocked GitHub API responses (success payload, labels, error responses).
