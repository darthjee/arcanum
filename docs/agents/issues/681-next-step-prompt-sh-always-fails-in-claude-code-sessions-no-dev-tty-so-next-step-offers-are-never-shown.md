# Issue: next_step_prompt.sh always fails in Claude Code sessions (no /dev/tty), so next-step offers are never shown

## Description
`arcanum/_lib/next_step_prompt.sh` asks its question on `/dev/tty`. When a skill runs from a Claude Code session, the script is called through the agent's Bash tool, which has no controlling terminal. The prompt therefore always exits `1` with:

```
Error: no interactive terminal (/dev/tty) available to prompt for the next step.
```

So the next-step offer (`/auto-plan-issue <id>` after `/discuss-issue`, `/auto-fix-issue <id>` after planning, and so on) never appears. The skill falls back to the "prompt unavailable" path, and the user has to type the next command by hand.

### Observed
- Skill: `/discuss-issue #1450` on `darthjee/majora` (arcanum commit `75f9492`).
- After a successful push, step 8 ran `next_step_prompt.sh --repo <repo> --command "/auto-plan-issue 1450"`, which returned `EXIT=1` with the error above.
- The push-only success report was printed, followed by "next-step prompt was unavailable". The user never got a chance to chain into planning.

## Problem
The project convention says scripts that need user input own the prompt on `/dev/tty` and never ask a chat-mediated yes/no (`AGENTS.md`, `per-repo-migrations.md`, `skill-finish.md`). That convention assumed "TTY-through-a-tool-call is confirmed to work reliably", but in at least some Claude Code environments the Bash tool has no controlling terminal. The prompt script then hard-fails with exit `1`, indistinguishable from a usage error, and the skill has no structured way to still ask the user.

## Expected Behavior
When there's no `/dev/tty`, as in any agent-driven session, the user should still be offered the next step and be able to accept it without retyping the command.

## Solution
The script detects the missing TTY and returns a distinct signal. The calling skill then asks in chat.

- `next_step_prompt.sh` keeps probing `/dev/tty` exactly as it does today. When the terminal is available, nothing changes.
- When `/dev/tty` cannot be opened, the script no longer fails with exit `1`. It prints `FALLBACK=chat` followed by one `COMMAND=<cmd>` line per `--command` on stdout, and exits `4`.
- On exit `4`, the calling skill asks the user with `AskUserQuestion`: **Yes / No / Chat**, showing the exact command(s). It maps the answer onto its existing `CHOICE=yes` / `CHOICE=no` / `CHOICE=chat` branches, so the behavior after the choice is unchanged.
- Exit `1` keeps its current meaning: a usage error or an invalid `--repo`, with nothing on stdout. Real errors are never silently turned into a chat question.

Updated output contract:

| Situation | stdout | exit |
|---|---|---|
| `[Y]es` | `CHOICE=yes` | `0` |
| `[N]o` | `CHOICE=no` | `0` |
| `[C]hat` | `CHOICE=chat`, `CHAT_CONTEXT=next_step` | `3` |
| `/dev/tty` unavailable | `FALLBACK=chat`, `COMMAND=<cmd>`… | `4` |
| usage error, bad `--repo`, TTY closed mid-prompt | nothing (stderr only) | `1` |

#### Alternatives considered
- **Skill falls back on exit `1`**: rejected. Exit `1` also means usage errors, which would get masked.
- **Detect the agent context via an env var**: rejected. It relies on an undocumented variable and could skip a TTY that works. Probing the TTY is the reliable test.
- **Always ask in chat, drop `/dev/tty`**: not chosen for now. It would reverse the convention completely. If the open environment question shows no Claude Code environment ever has a TTY, revisit it.
- **Open a real terminal elsewhere (e.g. `osascript`)**: rejected as platform-specific and intrusive.

### Scope
**In scope (this issue):**
- Define a single, shared convention for "no `/dev/tty` available → offer the prompt through chat instead", reusable by any arcanum script that owns a `/dev/tty` prompt.
- Apply it to `arcanum/_lib/next_step_prompt.sh` and its callers: `discuss-issue`, `plan-issue`, `arcanum-split-issue`, `enhance-issue`.

**Tracked separately (sub-issue):**
- `arcanum/migrations/run.sh` (driven by `/arcanum-migrate`) has the same failure mode for its `[A]ll/[N]one/[S]elect/[C]hat` prompt. It will adopt the convention defined here, in its own sub-issue.

**Out of scope:**
- `arcanum/install/installer.sh`, `arcanum/install/bootstrap.sh`, `arcanum/update/bootstrap.sh`, and the per-version migration scripts. These run from a human's shell or under `run.sh`, not directly through an agent's Bash tool.

**Open question:** does the `/dev/tty` prompt fail in every Claude Code environment (terminal CLI, desktop, web, orchestrators like FleetView), or only in some? If the plain terminal CLI does have a working TTY, the fix should be a fallback when the TTY is missing, not a replacement for it.

### Convention change (repo-wide)
This issue turns the no-TTY fallback into a repo-wide convention for script-driven interaction, replacing the current "`/dev/tty`, never chat-mediated" rule:

> A single master script owns the interaction on `/dev/tty` whenever a terminal is available, with a `[C]hat` escape hatch and an explicit `--repo`.
> When `/dev/tty` can't be opened, the script doesn't fail. It exits with the dedicated code **`4`** and prints **`FALLBACK=chat`** plus enough data for the skill to ask the same question.
> The skill then asks with **`AskUserQuestion`**, offering the same options as the terminal prompt, and maps the answer back onto the script's normal contract. For multi-step flows, it does that through the non-interactive subcommands.
> **Free-text chat yes/no stays forbidden.** The only allowed chat path is the structured `AskUserQuestion` fallback, and only after the script has reported there's no TTY.

Docs to update in this issue:
- `AGENTS.md`: the script-driven interaction bullet.
- `docs/agents/architecture/per-repo-migrations.md`: the "preferred convention" paragraph. Also soften "TTY-through-a-tool-call is confirmed to work reliably" to "works when the session has a controlling terminal; not guaranteed (see #681)".
- `docs/agents/architecture/skill-finish.md`: the Next-step offer section (intro sentence, output-protocol table with the new exit-`4` row, skill-side rules for the `AskUserQuestion` fallback).
- `docs/agents/issue-enhancement.md`: the "Script-driven interaction?" checklist item.

Sub-issue #682 (`run.sh` / `arcanum-migrate`) reuses this convention as is and does not redefine it.

### Backward compatibility
Callers of `next_step_prompt.sh` (five call sites across four skills; there is no native `core/` version):
- `discuss-issue/steps/discuss_and_save.md` (two call sites: `/auto-plan-issue` and `/auto-fix-issue`)
- `plan-issue/steps/write_and_confirm.md`
- `arcanum-split-issue/steps/push.md`
- `enhance-issue/steps/publish.md`

Contract impact:
- Exits `0` and `3` (`CHOICE=yes/no/chat`) are unchanged.
- Exit `1` narrows to usage error, bad `--repo`, or the TTY closing mid-prompt. It no longer covers "no TTY", so each caller's exit-`1` branch is reworded from "the prompt was unavailable" to "the next-step prompt failed: <stderr>".
- Exit `4` is new. Each caller gains the `FALLBACK=chat` branch, which asks with `AskUserQuestion` (see Solution).

Rules:
- All five call sites are updated in the same PR as the script change. Skills and `arcanum/_lib` ship together in the same arcanum release, so a new script never meets an old skill.
- Guard against future callers forgetting the fallback: add an item to the `skill-reviewer` agent's checklist. Any skill step that calls a `/dev/tty`-owning script must handle exit `4` / `FALLBACK=chat`.
- No per-repo migration is needed. Nothing changes inside consuming repos.

### Edge cases
- **Nested runs (`NESTED=true`)**: not affected. Nested runs are silent and never make a next-step offer.
- **`auto-*` skills / `auto-fix-all`**: not affected. They print `Next:` lines and never call the prompt. After the user picks Yes, the chained skill runs as its own top-level run.
- **Several `--command`s** (e.g. `arcanum-split-issue`): the `AskUserQuestion` lists every command, and Yes runs all of them in the order listed, the same as the terminal prompt. No per-command picking.
- **Free-text "Other" answer to `AskUserQuestion`**: treated as Chat. The skill returns to the conversation with the user's text as context.
- **Question dismissed or rejected**: treated as No. The commands are already visible in the closing report as the manual path.
- **`AskUserQuestion` unavailable** (e.g. headless `claude -p`, or the tool is denied): the skill prints "Next step: `<cmd>` (run it manually)" and ends.
- **TTY closed or EOF before a valid answer**: stays exit `1`. It is not a missing TTY and must not turn into a chat question.
- **`/dev/tty` opens but the user can't see it** (the probe succeeds and `read` blocks until the Bash tool timeout): known risk, out of scope for this issue. A `read -t` timeout (e.g. `ARCANUM_PROMPT_TIMEOUT`) that falls back to exit `4` could be added later if this is ever observed.

### Testing strategy
- Make the TTY device overridable for tests: `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"`. Document it as test-only, not a user-facing setting.
- Add a spec that runs `next_step_prompt.sh` with `ARCANUM_TTY_DEVICE` pointing to a path that doesn't exist, and asserts:
  - exit `4`, stdout `FALLBACK=chat` followed by one `COMMAND=<cmd>` line per `--command`, in order (one and several commands);
  - a usage error (missing `--repo`, missing or empty `--command`, `--repo` not a directory) still exits `1` with nothing on stdout, even when the TTY is unavailable, so argument validation still runs before the TTY probe.
- No manual-verification step is required by this issue.

## Benefits
- Next-step offers work in every Claude Code environment, not just ones with a controlling terminal.
- A missing TTY is distinguishable (exit `4`) from real errors (exit `1`), so bugs are not masked.
- One repo-wide convention that `run.sh` / `arcanum-migrate` (#682) and future interactive scripts reuse.
