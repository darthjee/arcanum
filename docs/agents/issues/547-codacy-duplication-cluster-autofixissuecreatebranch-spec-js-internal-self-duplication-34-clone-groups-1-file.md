# Issue: Codacy: duplication cluster — AutoFixIssueCreateBranch_spec.js internal self-duplication (34 clone groups, 1 file)

## Context

`core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js` has six tests, spread across the `checkout vs. create` (2 tests) and `branch name resolution` (4 tests) `describe` blocks (roughly lines 98-163), that each repeat the same 3-4 line "arrange → act → assert" boilerplate: build a `fakeExecFileAsync` stub, construct the `AutoFixIssueCreateBranch` instance, call `instance.run(PLAN_DIR, ID)`, then assert on the returned branch name (and, for two of them, the specific `git` calls made). Codacy flags 34 clone groups / ~60 duplicated lines confined to this one file, at line ranges matching this span.

Note: the six repeated tests are not all "branch already exists" scenarios — only one covers the checkout-existing-branch case. The other five cover: creating a new branch, falling back to `issue-<id>` when `plan.md` is missing, falling back when `plan.md` has no `## Branch` heading, extracting the name stripped of backticks/whitespace, and falling back when the extracted name is empty. The shared duplication is the setup/invoke boilerplate, not a single repeated scenario.

## What needs to be done

- Extract a shared setup helper (e.g. `async function runCreateBranch(planContent, { branchExists } = {})`) that writes the plan file when `planContent` is given, builds the fake `execFileAsync`, constructs `AutoFixIssueCreateBranch`, and returns `{ result, execFileAsync }` — replacing the repeated arrange/act block in all six tests.
- Keep each test's distinct assertions (on `result` and/or specific `execFileAsync` calls) inline in its own `it`, since the six scenarios differ materially from one another. This is a shared-setup extraction, not an `it.each` table — the scenarios aren't parallel variants of one case.

## Acceptance criteria

- [ ] The repeated arrange/act boilerplate across the six tests in `checkout vs. create` and `branch name resolution` is replaced by a shared setup helper.
- [ ] Each test's distinct scenario and assertions remain intact and readable.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.
