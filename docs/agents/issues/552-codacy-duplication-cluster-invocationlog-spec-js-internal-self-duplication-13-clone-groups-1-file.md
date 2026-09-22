# Issue: Codacy: duplication cluster — InvocationLog_spec.js internal self-duplication (13 clone groups, 1 file)

## Context

`core/spec/lib/utils/logging/InvocationLog_spec.js` (114 lines) has 6 tests under `describe('#record')`; 5 of them repeat the same ~8-10 line block that builds `execFileSpy`, `appendFileSpy`, and constructs `new InvocationLog({...})` (varying only the stubbed `execFileAsync`/`appendFileAsync` return values and `env`), roughly at lines 8-17, 29-36, 45-52, 60-67, 74-83, and 89-98. Codacy reports 13 clone groups and duplicated lines within this file.

This supersedes the original issue text (which described a repeated "log-entry assertion block" varying by event type, fixed via `it.each(eventTypes)`) — that shape does not match the file's current structure (last touched by the `core/lib/` reorg in #285). The actual duplication is in the spy/instance construction shared across tests, not in event-type-varying assertions.

## What needs to be done

- Extract the repeated `execFileSpy`/`appendFileSpy`/`InvocationLog` construction into a shared test helper, following the precedent set by `core/spec/support/utils/execCallTracker.js` (added in #550) — a small builder under `core/spec/support/utils/logging/` that each `it` block calls with only the overrides it needs (stub return values, `env`).
- Replace each test's inline construction with a call to that helper.

## Acceptance criteria

- [ ] The duplicated `execFileSpy`/`appendFileSpy`/`InvocationLog` construction across `InvocationLog_spec.js`'s tests is replaced by calls to a shared helper.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.
