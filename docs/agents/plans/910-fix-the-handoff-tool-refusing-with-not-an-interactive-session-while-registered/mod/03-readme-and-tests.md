# Update README and tests

Make the tests and the README match the new gate.

**Tests:**
- `contract.test.ts`: the non-interactive test keeps asserting that the tool is not registered. Drop its `NOT_INTERACTIVE` deny assertion: with no registration, the host would not route a call there.
- `reload.test.ts`: drop `interactive: true` from the seeded state. Add a test where no state is seeded at all (the shape of a `/clear` or resume: no `session.start`, empty session state), and assert that a call is accepted and runs `/clear` then the command at turn end.
- `scheduling.test.ts` (or a new test): after an interactive `startSession`, assert the full round-trip of `handoff` → `endTurn` → `[clear, <cmd>]`. Add tests for any hardening that step 02 introduced (for example, an `isSet: false` write is reported as an error).
- `test-support.ts`: drop `NOT_INTERACTIVE` and narrow `StateKey` to `'pending'`.

**README:**
- Remove `handoff is only available in an interactive session` from the error-results row.
- In "Headless (`claude -p`) and SDK hosts", drop the last sentence about a call that reaches the mod.
- In the Development table, change `types/index.d.ts` to list only `pending`.

## Files to Change
- `arcanum-next-step/hooks/contract.test.ts` — drop the `NOT_INTERACTIVE` assertion.
- `arcanum-next-step/hooks/reload.test.ts` — drop the seeded `interactive`; add the empty-state acceptance test.
- `arcanum-next-step/hooks/scheduling.test.ts` — add the round-trip test and any tests for step 02's hardening.
- `arcanum-next-step/hooks/test-support.ts` — drop `NOT_INTERACTIVE`; set `StateKey` to `'pending'`.
- `arcanum-next-step/README.md` — error list, headless section, Development table.
