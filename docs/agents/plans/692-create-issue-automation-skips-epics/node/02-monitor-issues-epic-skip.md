# Native `monitor-issues` Epic skip

In `MonitorIssuesMonitorIssues#_processIssue`, after the `Processing #…` log and before the `Tags.actionableTags` loop: if `Tags.extractTags(labels).includes('epic')`, log `Skipping #${id}: Epic` and skip the loop (so `failed` stays `false`). Then fall through to the existing `updated_at`/`tags` recording. Update the class doc comment that describes the dispatch.

## Files to Change
- `core/lib/commands/monitor-issues/MonitorIssuesMonitorIssues.js` — Epic skip before dispatch.
