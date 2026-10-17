# Issue: Handle CLEAR=true in skills at automatic next-step hops

## Description

Part of Epic #790 (sub-issue C). Make skills act on the `CLEAR=true` line that
`next_step_prompt.sh --auto-key` (and `auto-plan-issue/scripts/auto_next.sh`) now
print (#796), so an automatic next-step hop really starts the next command from a
cleared context. Uses the `arcanum-next-step` mod shipped in #797 when it is loaded,
and must still work without it.

## Problem

Since #796 the scripts emit `CLEAR=true` when both `next_step.auto.<skill>` and
`next_step.clear.<skill>` are `true`, but `skill-finish.md` (Skill-side rules) still
says "Skills ignore it for now; the handling lands with #798". Every auto hop
(enhance → discuss → auto-plan → auto-resolve) therefore keeps running in the same,
ever-growing context, and the shipped `arcanum-next-step` mod (#797) is inert
because no skill calls `mcp__arcanum-next-step__handoff`.

## Expected Behavior

On `CLEAR=true`, after all work is done (pushes, label changes, plan commit/push),
the closing report is printed and the `auto-continuing: ...` notice is relayed, the
skill hands off using the first available level:

1. **Mod** — if `mcp__arcanum-next-step__handoff` is in the tool list, call it with
   `{ command: "<COMMAND>" }` (exactly the offered command, e.g. `/discuss-issue 797`
   or `/loop /auto-resolve-issue 796`) and, on the success result, end the turn with
   no further output. The mod runs `/clear` then the command once the turn ends.
   - Error `a handoff is already pending: ...` → end the turn (the first handoff is
     still scheduled; never fall back, which would double-fire).
   - Any other error result (`handoff only runs arcanum skills`, `only available on
     the main loop`, `only available in an interactive session`) → fall to level 2.
2. **Wakeup + user `/clear`** — `ScheduleWakeup(delaySeconds=60, prompt="<COMMAND>",
   reason="clearing context before <COMMAND>", noop=false)` (loading it with
   `ToolSearch` if deferred), print one line — `type /clear now; <COMMAND> resumes
   in ~60s` (no mention of the mod) — and end the turn. A pending wakeup survives `/clear` (spike #791),
   so the command fires into the cleared context — or in place if the user did not
   clear in time.
3. **In place** — if neither tool is available (or the wakeup call fails), print a
   one-line `clear skipped: <reason>` notice and run the command inline exactly as
   on a plain `AUTO=true`.

A mod-submitted prompt arrives labelled as plugin-sent; the next skill treats it
like a typed command. A user interjection during the wakeup delay does not cancel
the hop (next skills are idempotent: draft resume, "plan already exists", branch
reuse). Without `CLEAR=true` behavior is byte-identical to today. Manual `[Y]es`
answers never clear.

## Solution

- **`docs/agents/architecture/skill-finish.md`**
  - Add a **Clearing** subsection under `#auto-next` documenting the three levels,
    the ordering (finish work → closing report → auto-continuing notice → clear →
    next command), the mod error handling above, and the interjection/idempotency
    note. Refer to the tool only by its full name `mcp__arcanum-next-step__handoff`
    (mod README stability rule).
  - Replace the "Skills ignore it for now" `CLEAR=true` bullet in **Skill-side
    rules** with a pointer to Clearing.
  - Update the **Next-step map** notes (auto keys + top-level `auto-plan-issue`
    paragraph) for clearing and the `AUTO_CLEAR=true` relay.
- **`auto-plan-issue` relay** — `steps/run.md`: on `CHAIN=yes` + `CLEAR=true`, the
  architect report ends with `AUTO_CLEAR=true` then `AUTO_NEXT=<cmd>`
  (`AUTO_NEXT=` stays last; no `AUTO_CLEAR` line otherwise). `SKILL.md`
  coordinator: relays everything above the control lines, never prints them, and
  on `AUTO_CLEAR=true` applies Clearing instead of `Skill(loop, …)` inline (level 3
  = today's inline invocation plus the "clear skipped" notice). It never re-reads
  config; `auto_next.sh` stays the single source of truth.
- **One-line pointers** to Clearing in each auto-keyed offer step:
  `enhance-issue` publish step, `discuss-issue/steps/discuss_and_save.md` (both
  offers), `plan-issue` offer step. Each `CHOICE=yes` + `AUTO=true` branch gains
  "with `CLEAR=true`, hand off per Clearing instead of running inline".
- **Mod README** — update the "Status: inert until a skill calls it" section, which
  says "Until #798 no skill calls it".
- **Verification** — the clear itself cannot be observed by the autonomous
  pipeline, so no new spec is added. The PR body lists a manual codeword test for
  each hop (enhance → discuss, discuss → auto-plan, auto-plan → auto-resolve), with
  the mod (clears automatically) and without it (wakeup + user `/clear`, and
  in place when the user does not clear), which the owner runs before merging.

**Out of scope:** `auto-fix-all` / `monitor-issues` `clear_context` (#795), hops
without an auto key, nested runs (never chain, never clear), any script change
(#796 already emits the protocol).

## Benefits

- Each pipeline stage starts from a clean context holding only the artifacts it
  re-reads (issue file, plan, state), improving quality and cutting token use.
- Activates the already-shipped mod; degrades gracefully so the chain never stalls.
