# core/bin/arcanum 125–127 exit-code contract

In `core/bin/arcanum`, map a `DispatchFailure` exit code in 125–127 to `1` (stdout payload still written), with a comment pointing at `docs/agents/specs/docker/dispatch.md` → "Exit codes and streams". This keeps dispatch's "125–127 means Docker failed" rule safe. Add a spec in `core/spec/bin/arcanum_spec.js` (or a focused new spec next to it, following its pattern) asserting 125, 126 and 127 each exit 1 while other codes (e.g. 3, 4) pass through. Use a fixture command or a stubbed Dispatcher, whichever the existing spec already does.

## Files to Change

- `core/bin/arcanum` — the 125–127 → 1 mapping.
- `core/spec/bin/arcanum_spec.js` — exit-code contract cases.
