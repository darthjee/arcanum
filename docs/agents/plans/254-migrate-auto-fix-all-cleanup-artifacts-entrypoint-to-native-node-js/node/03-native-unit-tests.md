# Write native unit tests

Add `core/spec/AutoFixAllCleanupArtifacts_spec.js`, mirroring `core/spec/lib/SpawnIssue_spec.js`'s structure (injected fake `execFileAsync`, no real `git`/network calls). Cover:

- Neither the issue file nor the plan dir tracked — no-op, exit 0, no commit/push called.
- Only the issue file tracked.
- Only the plan dir tracked.
- Both tracked — assert the commit message matches the hardcoded format exactly and push is called with the current branch.
- A missing required argument — throws/usage message.

## Files to Change

- `core/spec/AutoFixAllCleanupArtifacts_spec.js` — new file
