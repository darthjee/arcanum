# Node Plan: Codacy: duplication cluster — Origin_spec.js self-duplication + SafeBranch_spec.js (17 clone groups, 2 files)

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add a shared execFileAsync call-tracking spec helper](node/01-add-exec-call-tracker-helper.md)
- [02 — Parameterize Origin_spec.js's repeated assertions](node/02-parameterize-origin-spec.md)
- [03 — Reuse the shared helper in SafeBranch_spec.js](node/03-reuse-helper-in-safebranch-spec.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- `core/spec/lib/utils/git/Origin_spec.js` and `core/spec/lib/commands/shared/SafeBranch_spec.js` are the only two files Codacy flagged; no other spec references either duplicated fragment.
- The issue's line-number references (e.g. "93-105, 96-105, ...") predate several other recently-merged duplication fixes on unrelated files, so they no longer line up exactly with the current file content — the duplication patterns themselves (repeated remote-URL-format assertions, repeated repoPath-fallback/override tests, and the shared `execFileAsync`-tracking spy fragment) are still present and are what these steps target.
- Keep assertion intent identical — every existing `it(...)` description's behavior must still be exercised after the refactor, just via parameterization/shared helpers instead of copy-paste, per the issue's "unchanged coverage" acceptance criterion.
