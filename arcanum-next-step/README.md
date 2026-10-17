# arcanum-next-step

A Claude Code mod that lets an arcanum skill **truly clear context** at a next-step
handoff: once the current turn ends, it runs `/clear` and then the next arcanum skill
command, as if you had typed both.

## Why

Automatic next-step hops (`next_step.auto.*`) chain enhance → discuss → plan →
resolve in one session, so context keeps growing across stages. The
`next_step.clear.*` keys and the `CLEAR=true` protocol (#796) say *when* a hop should
start from a clean context, but spike #791 showed that neither a skill, the model,
settings hooks nor a `ScheduleWakeup` restart can run `/clear`. Only the person, or
a Claude Code mod through `$.command.run`, can. This mod is that mod (part of epic
#790).

## Status: inert until a skill calls it

The mod ships with arcanum and loads automatically, but it does nothing on its own:
it acts only when a skill calls its tool. Until #798 no skill calls it. Without the
mod, hops fall back to `ScheduleWakeup` plus asking you to type `/clear`.

## Tool contract

| Aspect | Contract |
| --- | --- |
| Name | `mcp__arcanum-next-step__handoff` (plugin `arcanum-next-step`, tool `handoff`). Registered on `session.start`, **not deferred**: visible from turn one, no `ToolSearch`. |
| Input | `{ command: string }`, required: exactly the `COMMAND=` line `next_step_prompt.sh` printed, e.g. `/discuss-issue 797` or `/loop /auto-resolve-issue 796`. No other fields: the tool always clears. |
| Success result | `scheduled: will /clear then run <command> once this turn ends — end your turn now without further output` |
| Error results | `handoff only runs arcanum skills` (not allowlisted, see below); `a handoff is already pending: <command>` (a second call before the turn ends; the first stays scheduled); `handoff is only available on the main loop` (called from a subagent); `handoff is only available in an interactive session` (see [Headless](#headless-claude--p-and-sdk-hosts)). Errors schedule nothing. |
| Timing | Nothing runs during the call. The mod keeps **one** pending command. When the main loop's turn ends with an answer, it runs `/clear`, then the command (`$.command.run`, outside the hook). |
| Cancellation | The pending command is dropped, with the toast `arcanum-next-step: handoff cancelled`, when the turn ends `aborted` (Esc), in a `refusal` or an `error`, or when you submit a prompt while it is pending (your input wins). A subagent's turn end is ignored. |
| Failure | If `/clear` or the command fails, the toast reads `arcanum-next-step: <error> — run <command> manually`, and the pending command is dropped. The context stays as it was (intact, or cleared without the next command); re-type the command. |
| Hot reload | The pending command lives in `$.state`, so it survives the mod reloading mid-turn (e.g. `/arcanum-update` rewriting it). |
| Detection | A skill checks whether `mcp__arcanum-next-step__handoff` is in its tool list. If it is present, it hands off; if it is absent, it falls back. There is no version handshake. |

### Stability rule

The tool's **name and input schema are a public contract** for the skills that call
it. Renaming the tool or changing its schema is a **breaking change** and must be
recorded here. Skills always refer to it by its **full name**,
`mcp__arcanum-next-step__handoff`, never as "the handoff tool", so it cannot be
confused with another plugin's `handoff`.

## Allowlist

`$.command.run` runs a command "as if the person typed it", so an unrestricted
handoff would let the model run built-ins it otherwise cannot (`/plugin install …`,
`/permissions`, `/config`, `/logout`, `/mcp`, `/hooks`) or other plugins' commands.
A prompt injection in something the model reads could ask for exactly that. The mod
therefore accepts only:

- **`/<skill>[ args]`**, where `<skill>` is an **arcanum skill**: a sibling folder of
  this mod's folder, in the same install, that holds a `SKILL.md`. The list is read
  from the install at session start (and again after a hot reload), so new skills
  are covered automatically, with no hardcoded list.
- **`/loop /<skill>[ args]`**: `/loop` is the single exception, and only when its
  first argument is itself an allowlisted skill.

The command is trimmed and split at its first whitespace run into name and
arguments. The arguments are passed on verbatim. `/clear` is never accepted, since
the mod issues it itself. Anything else (built-ins, other plugins' commands,
`/loop` wrapping a non-arcanum command, input without a leading `/`) gets the error
result `handoff only runs arcanum skills`. The worst case is therefore "an arcanum
skill ran after a clear". The cleared conversation is recoverable: its transcript
stays on disk, and `/resume` reopens it.

## Optional per-call approval

To approve every handoff by hand, add an `ask` permission rule for the tool, e.g. in
`.claude/settings.json` or `.claude/settings.local.json`:

```json
{
  "permissions": {
    "ask": ["mcp__arcanum-next-step__handoff"]
  }
}
```

This is off by default because it stalls unattended chains on a click.

## Opting out

- **Durable:** leave the `next_step.clear.*` keys unset. The mod never reads them;
  skills decide from them whether to call the tool, so nothing calls it.
- **Delete the folder:** this also works, but `/arcanum-update` adds it back.

## Loading

Claude Code auto-loads a plugin folder that sits inside a skills folder, and that is
where arcanum installs. So the release zip, `curl | bash`, git installs and
`/arcanum-update` all bring the mod in, with no extra step:

- It loads from the user skills folder (`~/.claude/skills/`, or
  `$CLAUDE_CONFIG_DIR/skills/`) and from a project's `.claude/skills/`.
- It does **not** load from a custom install path outside any skills folder. There,
  hops use the mod-free fallback.
- After `/arcanum-update` adds or changes it, it loads in **new** sessions. A session
  already open may not pick it up.

## Headless (`claude -p`) and SDK hosts

A headless run may exit as soon as its turn ends, before the handoff could run. The
mod therefore offers the tool only where a person is at the prompt
(`session.start`'s `isInteractive`). Under `claude -p` or an SDK host (which also
covers the desktop app's local sessions), the tool is **not registered**, so skills
see it as absent and fall back. A call that reaches the mod there anyway gets
`handoff is only available in an interactive session`.

## Two installs

If arcanum is installed both in your user skills folder and in a project's
`.claude/skills/`, both copies may load under the same name. It has not been verified
whether a single call could then fire twice. **Install arcanum in one place.**

## Development

The mod's files, all owned by the `mod` agent:

| Path | What |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifest; `"types"` names the `$.state` contract. |
| `hooks/hooks.json` | Lists the hooks module. |
| `hooks/register.ts` | The tool, the allowlist, and the turn-end scheduling. |
| `hooks/*.test.ts`, `hooks/test-support.ts` | The `claude plugin test` suite and its fake engine. |
| `types/index.d.ts` | The `$.state` values (`pending`, `interactive`). |
| `tsconfig.json` | Extends the engine-laid `.claude-plugin/types/tsconfig.json`. |

`.claude-plugin/types/` is written by Claude Code whenever it loads the mod from a
folder it watches. It is git-ignored and never committed. Check every change with
`make mod-check`, which runs:

```bash
claude plugin validate arcanum-next-step
tsc -p arcanum-next-step
claude plugin test arcanum-next-step
```
