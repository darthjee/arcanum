# Issue: Spike: verify whether a skill can truly clear context at a next-step handoff

## Description

Spike for Epic #790 (`next_step.clear.<skill>`). Before #790 picks a mechanism,
verify empirically whether any mechanism available to a skill actually **clears
the conversation context** at a next-step handoff, and recommend how #790 should
proceed.

## Problem

#790 assumed the clear would reuse `auto-fix-all`'s `clear_context` trick: under
`/loop`, call `ScheduleWakeup(..., prompt="<next command>")` and stop. That
assumption is unverified:

- `ScheduleWakeup` is a `/loop` dynamic-mode tool. `/enhance-issue` and
  `/discuss-issue` are normally invoked directly, not under `/loop`.
- The tool's own description says a wakeup resumes *with the conversation context
  still cached*. That suggests it re-fires the prompt in the **same** conversation
  rather than starting a clean one. If so, `auto-fix-all`'s and `monitor-issues`'
  `clear_context` may not actually clear context either.
- `/clear` and `/compact` are user-only built-in commands; the model cannot invoke
  them.
- A fresh subagent does start cold, but interactive stages (`discuss-issue`) cannot
  run inside a subagent.

## Expected Behavior

The spike answers, with evidence:

1. Does a `/loop` + `ScheduleWakeup` restart drop prior conversation context?
   Measure it, e.g. plant a marker early and ask the woken iteration whether it can
   see it, or compare context/token usage before and after.
2. Is `ScheduleWakeup` usable at all outside a `/loop` invocation?
3. Can any Claude Code hook, plugin or mod (see the `plugin-authoring` skill)
   trigger `/clear`, or start a fresh session that continues with a given prompt,
   from inside a skill?
4. Is there another supported way to hand off to a fresh interactive session
   (remote trigger, new local session plus `SendMessage`, and so on)?
5. Based on 1–4, does `auto-fix-all`'s and `monitor-issues`' `clear_context` do what
   its docs claim? If not, **open a separate follow-up issue** to correct those
   docs (or the behavior). The spike itself stays purely investigative and changes
   no files.

## Solution

This is a **manual spike**. The repo owner runs the experiments by hand in live
Claude Code sessions, possibly with Claude in an interactive session. It is **not**
planned with `/auto-plan-issue` and **not** queued in `auto-fix-all`, because the
autonomous pipeline cannot run or observe `/loop` and wakeup behavior.

Post the findings as a **comment on this issue**, with evidence for each of
questions 1–5, then close it. Nothing is committed. The durable record will be
#790's shared "Clearing" subsection in `skill-finish.md#auto-next`.

The findings recommend one of the following for #790:

- (a) a mechanism that truly clears context;
- (b) an assisted clear (stop the chain and print `/clear` plus the command);
- (c) running in a subagent where possible, otherwise continuing in place;
- (d) parking #790.

Out of scope: implementing #790 itself, and fixing the `clear_context` docs (that
goes in its own follow-up issue).

## Benefits

- #790's config keys, `CLEAR=true` protocol and `AUTO_CLEAR` relay stay the same
  whatever the outcome. The spike settles the only open part (the shared "Clearing"
  handling) before any code is written.
- It confirms or corrects the existing `clear_context` claims in `auto-fix-all` and
  `monitor-issues`.
