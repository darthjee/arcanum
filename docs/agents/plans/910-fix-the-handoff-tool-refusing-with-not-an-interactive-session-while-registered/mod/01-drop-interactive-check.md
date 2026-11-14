# Drop the interactive state check

The `handoff` tool is registered only when `session.start` reports `isInteractive: true`, and a registration lasts for the process. The `interactive` value in `$.state` is held per session, and `/clear` and resume do not fire `session.start` again, so the stored copy can disagree with the registration. Make the registration the only gate:

- In `session.start`, remove `await $.state.set(interactive, e.isInteractive)`. Keep the early `return next(e)` for a non-interactive session, before `listSkills` and `$.tool.register`.
- In `tool.call`, remove the `$.state.get(interactive)` read and the `NOT_INTERACTIVE` refusal. Keep the `agentId` check (`NOT_MAIN_LOOP`) as the first check.
- Delete the `NOT_INTERACTIVE` constant and the `interactive` state ref.
- Remove the `interactive` key from `PluginState['arcanum-next-step']` in `types/index.d.ts`.

## Files to Change
- `arcanum-next-step/hooks/register.ts` — drop the `interactive` ref, its write in `session.start`, its read and the `NOT_INTERACTIVE` refusal in `tool.call`.
- `arcanum-next-step/types/index.d.ts` — drop the `interactive` state key and its doc comment.
