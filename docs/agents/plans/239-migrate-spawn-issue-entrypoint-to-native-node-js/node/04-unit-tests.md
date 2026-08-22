# Unit tests for SpawnIssue.js

Add `core/spec/lib/SpawnIssue_spec.js`, injecting fakes for `githubIssue`, `execFileAsync`, `repoConfig`, and `origin` (no real `gh`/network calls, per the repo-wide "no real network calls in specs" rule). Cover:

- **Retry exhaustion**: `githubIssue.create` rejects every attempt up to `maxRetryCount` — asserts a thrown `DispatchFailure` whose `.stdout` is exactly `STATUS=failed\n`, and that the fake was called exactly `maxRetryCount` times (no sleep-related flakiness — inject/stub the sleep so the test doesn't actually wait).
- **Retry then success**: fails once, succeeds on the second attempt — asserts the final `STATUS=ok\n...` output and that no more attempts were made than necessary.
- **Parent label lookup failure fallback**: fake `execFileAsync` rejects the `gh issue view <parentId> --json labels` call — asserts only `Spawned` gets applied (single `--add-label Spawned`) and no exception propagates.
- **Label filtering**: parent labels include a mix of pipeline tags (e.g. `Refined`, `Ready`) and non-pipeline labels (e.g. `Feature`, `Bug`) — asserts pipeline tags are stripped, non-pipeline labels survive, and `Spawned` is always added once.
- **`--as-subissue` GraphQL failure fallback**: the `addSubIssue` mutation call rejects — asserts a stderr warning is produced (spy on `process.stderr.write` or an injected writer) but the overall call still resolves with `STATUS=ok`.
- **`--as-subissue` success**: asserts the GraphQL mutation is invoked with the two resolved node ids.
- **Scratch-file cleanup failure**: the cleanup unlink rejects — asserts the loud multi-line warning is written to stderr, and the call still resolves with `STATUS=ok` (exit 0), never throwing.
- **Linking comments best-effort**: both parent- and new-issue comment calls fail — asserts warnings only, no thrown error.

## Files to Change
- `core/spec/lib/SpawnIssue_spec.js` — new, covering the scenarios above.
