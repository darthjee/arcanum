# Interactive editor (`edit`)
Add `arcanum config agents email edit`, a focused loop to fill in or clear agent emails without running the whole `config setup` wizard.

**Dispatch.** In `runAgentsEmail()` treat `edit` as a verb like `set`/`unset`. It takes no positionals (`checkMaxArity`), refuses `--json` ("it is interactive"), `--all-tiers`, `--unset`, `--force`, `--string` and tier flags; accepts `--lock-timeout` (used by each write).

**No TTY.** Use the same check as `config setup` (`isInteractive(io, deps)`; extract it to a shared helper if needed): when not interactive, throw `UsageError('config agents email edit needs an interactive terminal', { hint: 'use arcanum config agents email set/unset instead' })`.

**Loop** (prompts on stderr via `createPrompter`, injectable through `deps.prompter` for specs):
1. Render the matrix from step 01.
2. `agent [<a>/<b>/…/default] (Enter to finish): ` — accept only the agents shown in the matrix or `default`; anything else prints an error with the hint `use arcanum config agents email set <agent> <email> for other agents` and re-asks. Empty answer ends the loop (exit `0`).
3. `email (- unsets): ` — `-` (`UNSET_ANSWER`) means unset; an empty answer re-asks; the value is stored as a plain string (no format validation, no `""`).
4. Tier: reuse `askTier` semantics with tiers local/repo/global, default `global`; outside a repo only `global` is offered (asked silently, like a single-tier key).
5. Confirm `[Y/n]` (`confirm`), naming the key (`git.email` or `git.agents.<agent>`), the value and the tier file; on yes write via `writeValue` (set, with the shadowed-tier note) or `delegate(…, 'unset', …)`; on no, nothing is written.
6. Back to 1.

Ctrl-C / Ctrl-D at a prompt (`Interrupted`) end the loop cleanly: already-confirmed writes stay, exit code as `config setup` uses for an interrupted wizard. A failed write reports the error and continues the loop.

Specs (with an injected prompter and `deps.isInteractive`): agent restriction (unknown name rejected, `default` accepted), set and unset at each tier, default tier global, outside-a-repo tier restriction, decline at confirm writes nothing, empty agent ends the loop, matrix re-rendered after a write, no-TTY usage error, refused flags, interrupt handling.

## Files to Change
- `cli/lib/commands/config/shortcuts/agentsEmail.js` — `edit` verb dispatch and flag checks.
- `cli/lib/commands/config/shortcuts/agentsEmailEdit.js` (new) — the interactive loop.
- `cli/lib/commands/config/setup.js` / `cli/lib/commands/config/setup/setting.js` — only if `isInteractive`/`askTier`/`confirm` need a small generalisation to be reused (e.g. `askTier` taking an explicit tier list); keep `config setup` behaviour unchanged.
- `cli/spec/lib/commands/config/shortcuts/agentsEmailEdit_spec.js` (new) — the specs above.
