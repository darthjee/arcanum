# Node Plan: Codacy: duplication cluster — AutoFixIssueCreateBranch_spec.js internal self-duplication (34 clone groups, 1 file)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Extract a shared `runCreateBranch` setup helper

In `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js`, add a helper alongside the existing `fakeExecFileAsync`/`writePlanFile` helpers:

```js
async function runCreateBranch(planContent, { branchExists = false } = {}) {
  if (planContent) {
    await writePlanFile(planContent);
  }
  const execFileAsync = fakeExecFileAsync({ branchExists });
  const instance = new AutoFixIssueCreateBranch({ repoPath }, { execFileAsync });
  const result = await instance.run(PLAN_DIR, ID);
  return { result, execFileAsync };
}
```

Replace the repeated arrange/act boilerplate in all six tests currently spread across the `checkout vs. create` (2 tests) and `branch name resolution` (4 tests) `describe` blocks with a call to `runCreateBranch(...)`, keeping each test's own distinct assertions (on `result` and, for the two `checkout vs. create` tests, on the specific `execFileAsync` calls) inline in its own `it`. Do not touch the `argument validation` or `git failure propagation` describe blocks — they aren't part of the flagged duplication and have their own distinct setup (missing args, a rejecting `checkout` call) that doesn't fit this helper's shape.

## Files to Change

- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js` — add `runCreateBranch` helper; rewrite the 6 tests in `checkout vs. create` and `branch name resolution` to use it instead of repeating the arrange/act boilerplate.

## CI Checks

- `core`: `yarn test` (CI job: `test`)

## Notes

- The original issue text described this as a single "branch already exists" scenario repeated six times, with a proposed `it.each(collisionCases)` + `expectBranchCollisionHandled` fix. That characterization was corrected during `/discuss-issue`: only 1 of the 6 tests is the checkout-existing-branch case: creating a new branch, missing `plan.md`, missing `## Branch` heading, backtick/whitespace stripping, and empty-name fallback are the other 5. The duplication is shared arrange/act boilerplate, not one repeated scenario — hence a shared setup helper rather than a parameterized table.
- Coverage must stay unchanged after the refactor (issue acceptance criterion) — run `yarn test` in `core/` and confirm no lines/branches in `AutoFixIssueCreateBranch.js` lose coverage.
