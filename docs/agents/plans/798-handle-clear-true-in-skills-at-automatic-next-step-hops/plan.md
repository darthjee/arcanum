# Plan: Handle CLEAR=true in skills at automatic next-step hops

Issue: [798-handle-clear-true-in-skills-at-automatic-next-step-hops.md](../../issues/798-handle-clear-true-in-skills-at-automatic-next-step-hops.md)

## Overview

Skills start acting on the `CLEAR=true` line that `next_step_prompt.sh --auto-key`
and `auto-plan-issue/scripts/auto_next.sh` already print (#796). The three-level
handoff (mod → wakeup + user `/clear` → in place) is documented once in a new
**Clearing** subsection of `docs/agents/architecture/skill-finish.md#auto-next`
(architect). Every auto-keyed offer step and the `auto-plan-issue` coordinator
point to it, and `auto-plan-issue` gains the `AUTO_CLEAR=true` relay
(skill-writer). The mod README and other docs that still say "inert until #798"
are updated (mod, architect). No script changes.

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)
- [mod](mod.md)

## Shared contracts

- **Anchor.** The subsection heading is `#### Clearing`, placed under
  `### Auto-next` in `docs/agents/architecture/skill-finish.md`. Pointers link to
  `skill-finish.md#clearing` (relative path from each step file, e.g.
  `../../docs/agents/architecture/skill-finish.md#clearing`).
- **Tool.** Always named in full: `mcp__arcanum-next-step__handoff`, input
  `{ command: "<cmd>" }` where `<cmd>` is the exact offered command
  (`/discuss-issue <id>`, `/auto-plan-issue <id>`, `/loop /auto-resolve-issue <id>`).
- **Levels, tried in order** (only when `CLEAR=true`, and only after all work,
  the closing report and the relayed `auto-continuing: ...` notice):
  1. **Mod.** Tool present → call it. Success result → end the turn with no further
     output. Error `a handoff is already pending: ...` → end the turn (never fall
     back). Any other error → level 2.
  2. **Wakeup.** `ScheduleWakeup(delaySeconds=60, prompt="<cmd>",
     reason="clearing context before <cmd>", noop=false)` (load it with
     `ToolSearch` if it is deferred). On success print exactly one line,
     `type /clear now; <cmd> resumes in ~60s`, and end the turn. Tool missing or
     call fails → level 3.
  3. **In place.** Print `clear skipped: <reason>` and run `<cmd>` inline exactly as
     on plain `AUTO=true`.
- **Relay lines** (top-level `auto-plan-issue` only): on `CHAIN=yes` followed by
  `CLEAR=true`, the architect's report ends with two lines, in this order:

  ```text
  AUTO_CLEAR=true
  AUTO_NEXT=/loop /auto-resolve-issue <id>
  ```

  `AUTO_NEXT=` is always last. Without `CLEAR=true`, there is no `AUTO_CLEAR` line.
  The coordinator never prints either line.
- **discuss-issue first offer + `CLEAR=true`.** The next command
  `/auto-plan-issue <id>` runs **top-level** after the clear (not nested). Before
  handing off, discuss-issue still runs the plan-it path's branch bootstrap and
  issue commit (`checkout_from_main.sh`, `commit_issue.sh`), so the issue file is
  committed and pushed on `issue-<id>`, and it **stays on `issue-<id>`** (no
  `checkout_safe_branch.sh`) so the top-level `auto_next.sh` branch check passes.
  It prints the push-only `success` report (`--summary "Issue #<id> refined and
  pushed to GitHub; planning hands off to /auto-plan-issue <id>."`), not the
  merged one.

## Notes

- Verification is manual (agreed in the issue): the PR body lists a codeword test
  per hop (enhance → discuss, discuss → auto-plan, auto-plan → auto-resolve), with
  and without the mod. No new spec.
- **Known gap:** a discuss-issue first hop that clears runs `auto-plan-issue`
  top-level, which changes no labels, so the `Refined` → `Ready` swap does not
  happen on that path, and the plan commit is only pushed when `auto_next.sh`
  chains. Documented in the Clearing subsection and the Next-step map; a follow-up
  can teach top-level `auto-plan-issue` to mark Ready.
