# Unit specs

Extend the jasmine spec with spies for the new deps. Cover:
- `REASON=branch`: no push, no mark-ready, no release.
- Config off: push happens, then mark-ready and release. Output `CHAIN=no/REASON=config/READY=true/RELEASED=true`.
- Config off + dirty tree (release throws): `RELEASED=false`, message on stderr, still resolves.
- Config off + mark-ready throws: `READY=false`, release still runs.
- Push fails (auto on or off): `REASON=push`, no mark-ready, no release.
- Auto on: `CHAIN=yes/READY=true`, no release. With clear: `CHAIN=yes/CLEAR=true/READY=true`.
- Nothing from mark-ready or release ever reaches the returned stdout.

## Files to Change
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext_spec.js` — new cases, updated expected outputs.
