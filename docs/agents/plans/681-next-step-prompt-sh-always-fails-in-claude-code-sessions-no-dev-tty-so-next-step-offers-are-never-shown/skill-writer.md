# Skill Writer Plan: next_step_prompt.sh always fails in Claude Code sessions (no /dev/tty), so next-step offers are never shown

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on the `next_step_prompt.sh` output/exit contract and the "Skill-side handling of exit `4`" rules from [plan.md](plan.md#shared-contracts). Use the same wording at every call site.

## Implementation Steps

### Step 1 — Handle exit `4` and reword exit `1` at all five call sites
At each call site:
- Update the `> Resolve ...` note that lists the script's outputs to include `FALLBACK=chat` + `COMMAND=` lines (exit `4`).
- Add an **exit `4`** branch: ask with `AskUserQuestion` (Yes / No / Chat, naming the exact command(s)), then follow the matching existing branch (`CHOICE=yes` / `CHOICE=no` / `CHOICE=chat`), per the shared rules: "Other" free text → chat, dismissed → no, `AskUserQuestion` unavailable → print "Next step: `<cmd>` (run it manually)" and end.
- Reword the **exit `1`** branch from "the next-step prompt was unavailable" to "the next-step prompt failed: <stderr>", then end as before.
- Replace "never a chat-mediated yes/no" / "Never re-ask in chat" wording so it doesn't contradict the fallback. Keep the rule against *free-text* chat yes/no, and against re-asking after the user has answered.

Call sites:
- `discuss-issue/steps/discuss_and_save.md`: step 8's `/auto-plan-issue <id>` offer (its push-only path groups exit `1` with `CHOICE=no`/`chat`; exit `4` answers must route to "push only" or "plan it" according to the mapped choice), and sub-step 8.8's `/auto-fix-issue <id>` offer.
- `plan-issue/steps/write_and_confirm.md`: the `/auto-fix-issue <id>` offer.
- `arcanum-split-issue/steps/push.md`: the multi-`--command` offer (Yes runs every listed command, in order).
- `enhance-issue/steps/publish.md`: step 5's `/discuss-issue <id>` offer.

## Files to Change
- `discuss-issue/steps/discuss_and_save.md` — two call sites.
- `plan-issue/steps/write_and_confirm.md` — one call site.
- `arcanum-split-issue/steps/push.md` — one call site (several commands).
- `enhance-issue/steps/publish.md` — one call site.

## Notes
- The mapping logic stays in prose, not a script: `AskUserQuestion` is a tool call the agent makes, not something bash can do.
- Point readers to `docs/agents/architecture/skill-finish.md`'s Next-step offer section for the full contract instead of duplicating the table at each call site.
