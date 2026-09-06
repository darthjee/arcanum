# Node Plan: Add layering-boundary lint guardrail to core/eslint config

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared GitHub-issue-creation logic into a services/ class](node/01-extract-github-issue-service.md)
- [02 — Add the layering-boundary lint rule](node/02-add-layering-boundary-lint-rule.md)
- [03 — Document the rule as lint-enforced](node/03-update-script-engine-doc.md)

## CI Checks

- `core/`: `yarn lint` (CI job: `checks`)
- `core/`: `yarn test` (CI job: `test`)

## Notes

- Step 01 must land before step 02's rule is turned on for real, or the existing `context/RepoContext.js` → `commands/shared/GithubIssue.js` import will fail lint immediately.
- Confirmed via `grep` that `context/RepoContext.js` is the *only* current import from `context/`, `services/`, or `utils/` back into `commands/` — no other pre-existing violations to account for.
