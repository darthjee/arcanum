# Unit tests

Write `core/spec/lib/commands/discuss-issue/DiscussIssueRenderIssue_spec.js` (Jasmine, mirroring `core/lib/`'s layout 1:1 per `docs/agents/architecture/script-engine.md`).

Cover:
- All sections present (title + description + problem + expected_behavior + solution + benefits) — asserts every placeholder is substituted and the section order matches the template.
- Each section individually omitted (empty string) — one example per section (description, problem, expected_behavior, solution, benefits) — asserts the omitted section's blank lines collapse away cleanly.
- Multiple consecutive omissions (e.g. problem + expected_behavior + solution all empty) — the case most likely to expose an off-by-one in the blank-line-collapsing regex/logic, since it produces a longer run of consecutive blank lines than a single omission would.
- Missing/empty `outputFile` argument — throws, no file written.
- Missing/empty `title` argument — throws, no file written.
- Use a temp directory (see existing specs under `core/spec/lib/commands/` for the project's temp-dir/fixture-cleanup convention) for `outputFile` so the test writes and reads back a real file rather than mocking `fs`.

## Files to Change

- `core/spec/lib/commands/discuss-issue/DiscussIssueRenderIssue_spec.js` — new unit spec covering the cases above.
