# Register the command and native unit tests

## Files to Change

- `core/lib/core/commands.js` — add, in alphabetical position among the `auto-monitor-*` entries:
  ```js
  'auto-monitor-pr-monitor-pr': {
    module: 'commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js',
    method: 'run',
    context: 'repo'
  },
  ```
  Also update the file's own top-of-file JSDoc comment block that enumerates which commands use which `context` value (it currently lists `auto-monitor-issue-pr-resolve-pr-number` explicitly among the `'repo'` entries — add this one alongside it, following that same documentation convention).
- `arcanum/_lib/migration-status.json` — flip `"auto-monitor-pr-monitor-pr": false` to `true`.
- `core/spec/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr_spec.js` (new) — follow the existing spec layout under `core/spec/lib/commands/auto-monitor-issue-pr/` and `core/spec/lib/commands/auto-fix-all/` for structure/support-factory conventions. Cover, at minimum (one `it`/`describe` block per row, injecting stubbed `prMonitor`/`issueStateService`/`jsonReader`/`githubClient` collaborators rather than hitting real `gh`/network):
  - `merged` → prints `merged\n`, deletes the correct state file for both modes (issue-state path and legacy per-PR-file path).
  - `closed` → prints `closed\n`.
  - `approved` via latest-review — only the LATEST review from the owner counts (an earlier `APPROVED` followed by a later non-approved review must NOT count as approved).
  - `approved` via a `:shipit:` comment — AND assert `last_comment_time` is deliberately NOT persisted on this path (per node/04's callout).
  - `commented` — regular new owner comment(s): asserts the exact `---\nid: ...\nurl: ...\n<body>` formatting for multiple comments, and that state transitions from absent → `fetched` → `processing` (both persisted, in that order) with the right `emojis` values at each phase.
  - `pending` — no new comments, and separately, a transient GitHub-call failure (should also degrade to `pending`, never throw).
  - Both state-file shapes: same scenario (e.g. a regular new comment) run once with `--issue-id` and once without, asserting the state ends up in the right location with the right shape in both cases.
  - The `processing` → `addressed` resolution on a fresh invocation: seed a `processing` entry, invoke `run()`, assert reactions swapped (`removeReaction(EYES)` then `addReaction(THUMBS_UP)`, in that order) and the entry's `state`/`emojis` updated — for both state-file shapes.
  - Usage error: missing `--pr-number`, and an unrecognized flag — both throw the exact usage string.
  - `--pr-number` with a leading `#` is accepted and stripped.
