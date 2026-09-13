# Mark both findings Ignored in Codacy

Mark the two open SRM findings (resultDataId `131530704297` and `131530705345`, category XSS, "Unencoded input 'prUrl' used in HTML context") as "Ignored"/false-positive directly in Codacy — via the dashboard UI (Security → the finding → mark as ignored/false positive, with a short justification referencing issue #461) or via the Codacy API/MCP tools if a write path for SRM item status exists.

This is the durable suppression mechanism: SRM findings carry a dedicated `Ignored` status (distinct from Codacy's ordinary quality-issue list, which issue #460 addressed with a code comment alone) — a source comment alone is not confirmed to affect SRM dashboard state, so don't rely on it as the sole fix.

Record the justification used (e.g. "False positive: `prUrl` is a test-fixture string from an env var, never rendered as HTML — see issue #461") so it's visible to anyone reviewing the Codacy dashboard later.

## Files to Change

- None — this step is an action on the external Codacy dashboard/API, not a repo file change.
