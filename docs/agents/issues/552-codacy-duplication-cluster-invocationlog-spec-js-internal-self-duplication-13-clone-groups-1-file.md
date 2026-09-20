# Codacy: duplication cluster — InvocationLog_spec.js internal self-duplication (13 clone groups, 1 file)

## Context

`core/spec/lib/utils/logging/InvocationLog_spec.js` (95 lines) repeats the same 10-11 line log-entry assertion block three times (roughly lines 11-21/46-56/92-102) and a shorter 8-9 line variant twice more (roughly lines 45-54/60-69 and 61-69/77-85), each just varying the logged event type. Codacy reports 13 clone groups and roughly 35 duplicated lines within this file.

## What needs to be done

- Replace the repeated log-entry checks with a single `it.each(eventTypes)` parameterized test.
- Drive the parameterized test with a shared `expectLoggedEntry(type, payload)` helper.

## Acceptance criteria

- [ ] The repeated log-entry assertion blocks in `InvocationLog_spec.js` are replaced by a single parameterized test.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.
