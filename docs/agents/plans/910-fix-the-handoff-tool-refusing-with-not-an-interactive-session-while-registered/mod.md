# Mod Plan: Fix the handoff tool refusing with "not an interactive session" while registered

Main plan: [plan.md](plan.md)

## Shared contracts

- Remove the `handoff is only available in an interactive session` deny. The remaining deny texts are `handoff only runs arcanum skills`, `handoff is only available on the main loop`, `a handoff is already pending: <command>` and the catch-all `arcanum-next-step: handoff failed`.
- Keep the tool unregistered when `session.start` has `isInteractive: false`.

## Steps

- [01 — Drop the interactive state check](mod/01-drop-interactive-check.md)
- [02 — Investigate and harden the state round-trip](mod/02-investigate-state-round-trip.md)
- [03 — Update README and tests](mod/03-readme-and-tests.md)

## CI Checks

- `arcanum-next-step`: `claude plugin validate arcanum-next-step && claude plugin test arcanum-next-step` (CI job: `mod-checks`)
- `arcanum-next-step`: `make mod-check` locally (adds the `tsc -p` gate that CI skips)

## Notes

- The ward refusal happened on the **first** call of a fresh session, with no earlier `/clear` or resume. So the `/clear` lifetime mismatch is real but does not explain ward on its own. Step 02 must look for a cause that also fits a fresh session.
- The README's "Two installs" section warns that two copies of arcanum may load under the same plugin name. Both copies would share `$.state` and their hooks would both run. Consider it as a candidate in step 02.
- If `$.state` writes turn out to be unreliable, removing the `interactive` check alone would make calls *accepted* that then never run. That is why step 02 is part of this issue.
