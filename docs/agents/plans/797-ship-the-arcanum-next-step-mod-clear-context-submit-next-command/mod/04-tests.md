# Tests

Write `*.test.ts` files for `claude plugin test` covering:

- **contract:** `handoff` registered on `session.start`, not deferred, schema
  `{ command }`.
- **allowlist:** an allowlisted skill accepted; `/loop <allowlisted skill>` accepted;
  `/plugin`, `/config`, `/clear`, another plugin's command, `/loop <non-arcanum>`,
  input without a leading `/` denied with the exact text.
- **timing:** nothing runs during the call; on `turn.complete` (`reason: 'answer'`, no
  `agentId`) `command.run` gets `clear` then the command, in that order.
- **cancellations:** `aborted` / `refusal` / `error` turn end; a user `prompt.submit`
  while pending; a second call (rejected, first kept); a call with `agentId` (denied);
  a subagent's `turn.complete` (ignored, still pending).
- **failure:** a `command.run` rejection → toast, pending cleared.
- **reload:** the pending value survives a module reload.

Run `make mod-check` (validate + tsc + test); all must pass.

## Files to Change
- `arcanum-next-step/hooks/register.test.ts` — new (split into more files if large).
