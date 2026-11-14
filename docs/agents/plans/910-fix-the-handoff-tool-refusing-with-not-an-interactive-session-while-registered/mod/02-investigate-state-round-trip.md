# Investigate and harden the state round-trip

In ward, the `interactive` flag read back false on the first call of a fresh session, even though the same `session.start` had written `true` before registering the tool. The `pending` handoff uses the same `$.state` mechanism, so whatever lost that write could also lose a scheduled handoff: the call would be accepted and then never run.

Investigate against the host contract in the engine-written `.claude-plugin/types/claude-code/index.d.ts` (`$.state`, `session.start`, `session.end`):

- Check that the refs' `plugin: 'arcanum-next-step'` always equals `$.plugin.name` under the installed name. A write to another plugin's value is refused, so check what `set` returns and whether it throws. If they can differ, derive the refs from `$.plugin.name`, or at least check the `{ isSet }` result.
- Check whether a worker respawn, a re-enable or a second loaded copy (README "Two installs") can reset or split `$.state` while the registration survives.
- Check `/clear` and resume. They give the process a new session id and fire no `session.start`. Find out whether `pending` written just before the handoff's own `/clear` is still read correctly at that same turn's end. It should be, since `turn.complete` runs before the clear, but confirm this against the contract.

Fix what applies. If a root cause cannot be shown from the contract, keep the change from step 01 and, if it is cheap, make `tool.call` fail loudly when `$.state.set(pending, ...)` reports `isSet: false`, instead of returning `scheduled: ...`. Record the findings in the PR description.

## Files to Change
- `arcanum-next-step/hooks/register.ts` — any hardening of the `pending` write and read (ref derivation, `isSet` check) that the investigation calls for.
