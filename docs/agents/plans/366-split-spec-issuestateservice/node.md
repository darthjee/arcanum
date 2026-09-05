# node Plan: Split spec IssueStateService

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Split `IssueStateService_spec.js` into 3 grouped files and delete the original

Create the three new sibling spec files in `core/spec/lib/services/`, moving each `it`
verbatim (no assertion changes) from the current `IssueStateService_spec.js` into its new
home, per the grouping below. Each new file keeps its own top-level `describe` and its own
copy of the shared `beforeEach`/`afterEach` (`repoPath`/`context`/`stateFile` via
`createTempDir`/`removeTempDir`) — this setup is already a thin call into a shared test
utility, so duplicating the few lines that wire it up across 3 files is preferable to adding
a fourth factory file for it.

- `IssueStateServiceWrite_spec.js` — top-level `describe('IssueStateService (write & read)')`,
  containing the current `#write` block (5 `it`s) and `#get` block (3 `it`s).
- `IssueStateServiceSet_spec.js` — top-level `describe('IssueStateService (field setters)')`,
  containing the current `#set` block (4 `it`s) and `#setJson` block (4 `it`s).
- `IssueStateServiceAppendJson_spec.js` — top-level `describe('IssueStateService#appendJson')`,
  containing the current `#appendJson` block (5 `it`s).

Once all three files exist and pass, delete the original
`core/spec/lib/services/IssueStateService_spec.js`.

`core/lib/services/IssueStateService.js` and its collaborators (`Lock`, `JsonParser`,
`JsonReader`, `JsonValueFormatter`, `IssueStatePaths`) are not touched — this is a pure
spec-file reorganization.

## Files to Change

- `core/spec/lib/services/IssueStateServiceWrite_spec.js` — new file; `#write` (5 `it`s) +
  `#get` (3 `it`s), moved verbatim.
- `core/spec/lib/services/IssueStateServiceSet_spec.js` — new file; `#set` (4 `it`s) +
  `#setJson` (4 `it`s), moved verbatim.
- `core/spec/lib/services/IssueStateServiceAppendJson_spec.js` — new file; `#appendJson`
  (5 `it`s), moved verbatim.
- `core/spec/lib/services/IssueStateService_spec.js` — deleted once the three files above
  cover every `it` it used to contain.

## CI Checks

- `core/`: `yarn test` (CI job: `test`) — same total spec/`it` count as before, coverage for
  `core/lib/services/IssueStateService.js` unchanged.
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- No production code or assertion changes — pure navigability improvement.
- Do not split `Lock_spec.js`, `IssueStatePaths_spec.js`, or `JsonParser_spec.js` — out of
  scope per the issue.
