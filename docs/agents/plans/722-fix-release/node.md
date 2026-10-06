# Node Plan: Fix release

Main plan: [plan.md](plan.md)

## Shared contracts

- Follow the **spec convention**: one string literal per migration file, holding the full relative path.
- Point at the versioned folder the migrations now live in: `arcanum/migrations/repos/2.0.0/`.

## Implementation Steps

### Step 1 — Repoint `migrationsNextStepAuto_spec.js` at `repos/2.0.0`

In `core/spec/bin/migrationsNextStepAuto_spec.js`, replace `MIGRATIONS_DIR` and the `SCRIPTS` mapping (`['001','002','003'].map((id) => [id, path.join(MIGRATIONS_DIR, \`${id}.sh\`)])`) with an explicit list:

```js
const SCRIPTS = [
  ['001', path.join(REPO_ROOT, 'arcanum/migrations/repos/2.0.0/001.sh')],
  ['002', path.join(REPO_ROOT, 'arcanum/migrations/repos/2.0.0/002.sh')],
  ['003', path.join(REPO_ROOT, 'arcanum/migrations/repos/2.0.0/003.sh')]
];
```

Keep the rest of the spec unchanged: test names (`${id}.sh ...`), the TTY probe, and the pending logic. Update the header comment: it currently says "the `next/001`–`003` repo migrations". Change it to `2.0.0/001`–`003`, still mentioning issue #716, and add one sentence noting the one-literal-per-file convention so `scripts/bump-version.sh` can rewrite these paths in the future. Optionally rename the top-level `describe('next/ auto-next migrations', ...)` to `describe('2.0.0 auto-next migrations', ...)`.

Do **not** touch `core/spec/bin/migrationsEpicLabel_spec.js`. It already points at `repos/1.2.0` and isn't broken.

## Files to Change

- `core/spec/bin/migrationsNextStepAuto_spec.js` — explicit `repos/2.0.0/00N.sh` paths, one literal each; refresh the header comment.

## CI Checks

- `core`: `yarn test` (CI job: `test`) and `yarn lint` (CI job: `checks`), both run from `core/`. Locally you can run just this spec: `npx jasmine spec/bin/migrationsNextStepAuto_spec.js` from `core/`.

## Notes

- All 6 failures in the issue log (`config` and unknown-subcommand cases for 001–003) should pass once the paths resolve. The 4 pending specs stay pending in CI by design.
