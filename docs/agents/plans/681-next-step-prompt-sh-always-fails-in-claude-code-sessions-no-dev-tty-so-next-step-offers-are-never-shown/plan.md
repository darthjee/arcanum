# Plan: next_step_prompt.sh always fails in Claude Code sessions (no /dev/tty), so next-step offers are never shown

Issue: [681-next-step-prompt-sh-always-fails-in-claude-code-sessions-no-dev-tty-so-next-step-offers-are-never-shown.md](../../issues/681-next-step-prompt-sh-always-fails-in-claude-code-sessions-no-dev-tty-so-next-step-offers-are-never-shown.md)

## Overview
`arcanum/_lib/next_step_prompt.sh` keeps prompting on `/dev/tty` when one is available. When `/dev/tty` cannot be opened, it prints `FALLBACK=chat` and `COMMAND=` lines and exits `4` instead of failing with exit `1`. Its five call sites (four skills) handle exit `4` by asking the user with `AskUserQuestion` and mapping the answer onto the existing `CHOICE=` branches. The repo-wide "`/dev/tty`, never chat-mediated" rule is rewritten into "TTY first, structured `AskUserQuestion` fallback", `skill-reviewer` gains a checklist item for it, and a jasmine spec pins the new exit-code contract through a test-only TTY override.

## Agents involved

- [scripter](scripter.md): the script change in `arcanum/_lib/next_step_prompt.sh`.
- [node](node.md): the spec under `core/spec/bin/`.
- [skill-writer](skill-writer.md): the five skill call sites.
- [architect](architect.md): the repo-wide convention docs and the `skill-reviewer` agent definition.

## Shared contracts

**`next_step_prompt.sh` output/exit contract** (the single source of truth for all four agents):

| Situation | stdout | stderr | exit |
|---|---|---|---|
| `[Y]es` on the TTY | `CHOICE=yes` | — | `0` |
| `[N]o` on the TTY | `CHOICE=no` | — | `0` |
| `[C]hat` on the TTY | `CHOICE=chat` then `CHAT_CONTEXT=next_step` | — | `3` |
| TTY device cannot be opened | `FALLBACK=chat`, then one `COMMAND=<cmd>` line per `--command`, in the order given | nothing required | `4` |
| usage error (missing `--repo`, missing/empty `--command`, unknown argument), `--repo` not a directory, or TTY closed/EOF before a valid answer | nothing | error message | `1` |

- Argument validation runs **before** the TTY probe, so a usage error exits `1` even when no TTY is available.
- `COMMAND=` values are the `--command` strings verbatim (no quoting or escaping added).

**Test-only TTY override:** `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"`. Documented in the script header as test-only, not a user-facing setting. The spec sets it to a path that doesn't exist to simulate "no TTY".

**Skill-side handling of exit `4`** (identical wording across all call sites; also documented in `skill-finish.md`):
- Ask with `AskUserQuestion`: question naming the exact command(s) from the `COMMAND=` lines; options **Yes** (run it now; with several commands, run all of them in order), **No**, **Chat**.
- Yes → follow the existing `CHOICE=yes` branch. No → the `CHOICE=no` branch. Chat → the `CHOICE=chat` branch.
- A free-text "Other" answer → the `CHOICE=chat` branch, with the text as context.
- Dismissed/rejected question → the `CHOICE=no` branch.
- `AskUserQuestion` unavailable (headless, tool denied) → print "Next step: `<cmd>` (run it manually)" and end.
- Exit `1` is reworded at every call site from "the next-step prompt was unavailable" to "the next-step prompt failed: <stderr>", and still ends the skill.

**Convention name used in all docs:** "TTY-first with `AskUserQuestion` fallback" — exit `4` + `FALLBACK=chat` is the repo-wide signal for "no TTY, ask in chat", reused by #682 (`run.sh`).
