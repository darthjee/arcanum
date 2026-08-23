# Native unit tests

Write `core/spec/AutoFixAllWaitCi_spec.js` covering, with all collaborators injected/stubbed (no real network calls, per `docs/agents/architecture/script-engine.md`'s testing conventions):

- No PR found for the current branch → error message/exit-1 contract.
- Zero check-runs registered → keeps polling (assert the injected sleep hook is invoked, not a real 5s wait).
- Ignored-pattern filtering (case-insensitive) excludes matching check-runs from the passed/failed/total accounting entirely.
- All (non-ignored) check-runs completed+success → `passed`, exit 0.
- Any completed failure/cancelled/timed_out → `failed` + the failed check-run names, exit 0.
- Pending check-runs (not yet completed) → keeps polling.
- Transient `fetch`/API errors → retried, not raised.
- `getIgnoredCheckPatterns` is read once, not re-read every poll iteration (mirrors the shell script reading it before the loop).

Add corresponding unit tests to `core/spec/RepoConfig_spec.js` for the new `getIgnoredCheckPatterns` method from Step 02: happy path, missing file, missing/malformed field, malformed JSON.

## Files to Change

- `core/spec/AutoFixAllWaitCi_spec.js` — new file.
- `core/spec/RepoConfig_spec.js` — add cases for `getIgnoredCheckPatterns`.
