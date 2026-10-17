# Scheduling, cancellation and failure handling

On a valid call, store `{ command, name, args }` in `$.state` and return the success
result (exact text in the shared contracts). Nothing else runs inside the call.

`turn.complete` hook (always `return next(e)`; act after it):
- Ignore events with `e.agentId` set.
- No pending handoff → nothing.
- `e.reason !== 'answer'` → clear the pending value, toast
  `arcanum-next-step: handoff cancelled`.
- `reason === 'answer'` → clear the pending value, then `$.clock.after(0, …)` (outside
  the hook) run `await $.command.run({ command: 'clear' })` then
  `await $.command.run({ command: name, args })`. Any rejection → toast
  `arcanum-next-step: <error> — run <command> manually`.

`prompt.submit` hook: when a handoff is pending and the prompt's origin is the user
(not a plugin), clear the pending value and toast `arcanum-next-step: handoff
cancelled`; always `return next(e)` unchanged.

Because the pending value lives in `$.state`, a hot reload mid-turn keeps it.

## Files to Change
- `arcanum-next-step/hooks/register.ts` — success path, `turn.complete` and
  `prompt.submit` hooks.
