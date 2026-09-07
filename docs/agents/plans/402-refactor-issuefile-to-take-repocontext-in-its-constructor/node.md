# Node Plan: Refactor IssueFile to take repoContext in its constructor

Main plan: [plan.md](plan.md)

## Steps

- [01 — Make IssueFile an instantiable class with an optional repoContext](node/01-instantiable-class-with-optional-repocontext.md)
- [02 — Migrate the three call sites to repoContext construction](node/02-migrate-call-sites.md)
- [03 — Remove repoPath from findExisting](node/03-remove-repopath-param.md)
- [04 — Rename the class away from IssueFile](node/04-rename-class.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test` in `core/`)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint` in `core/`)

## Notes

- Steps 01–03 are the "phased fallback" the issue asks to keep: after Step 01 the class
  accepts both calling styles (per-call `repoPath` **and** constructor `repoContext`) with
  spec coverage for both; Step 02 moves every call site onto `repoContext`; Step 03 then
  deletes the now-dead `repoPath` parameter and its fallback. They all land in one PR — the
  intermediate state is a review aid, not a shipped release.
- `titleFromFilename` never took `repoPath` and gets **no** fallback in any step. Its only
  change is `static` → instance in Step 01. A consequence of that plus Step 03's
  "`repoContext` required at construction" is that `#titleFromFilename` spec cases must
  construct with a `createRepoContextMock()` (bare — the mock's `/fake/repo` default is
  fine; the method ignores `repoPath`).
- Only these references to the class are in live code and must move in Step 04:
  `ResolveAndFetch.js`, `ResolvePlanPaths.js`, `ResolveIdAndFile.js` (imports + calls), the
  spec file, and the `IssueFile.js` doc mention in
  `core/lib/utils/file/IssueStatePaths.js`. The other repo hits for the substring
  "IssueFile" belong to the unrelated `ArcanumSplitIssueCreateSubIssueFile` /
  `subIssueFile` names — do not touch them.
- Verify with `make core-test` and `make core-lint` before considering any step done.
