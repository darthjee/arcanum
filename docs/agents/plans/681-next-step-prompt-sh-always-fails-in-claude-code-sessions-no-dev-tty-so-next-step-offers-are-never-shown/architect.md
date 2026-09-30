# Architect Plan: next_step_prompt.sh always fails in Claude Code sessions (no /dev/tty), so next-step offers are never shown

Main plan: [plan.md](plan.md)

## Shared contracts

You document the `next_step_prompt.sh` output/exit contract, the "Skill-side handling of exit `4`" rules and the "TTY-first with `AskUserQuestion` fallback" convention from [plan.md](plan.md#shared-contracts). Other agents' work must match these docs.

## Implementation Steps

### Step 1 — Rewrite the repo-wide interaction convention
Replace the "`/dev/tty`, never chat-mediated" rule with the convention from the issue's "Convention change (repo-wide)" section: a single master script owns the interaction on `/dev/tty` when available. When the TTY can't be opened, the script exits `4` with `FALLBACK=chat` plus enough data to ask the same question, and the skill asks via `AskUserQuestion` with the same options, mapping the answer back onto the script's contract (for multi-step flows, through its non-interactive subcommands). Free-text chat yes/no stays forbidden.
- `docs/agents/architecture/skill-finish.md`: in the "Next-step offer" section, rewrite the intro sentence; add the exit-`4` row to the output-protocol table and drop "`/dev/tty` unreadable" from the exit-`1` row; add the exit-`4` handling (and the reworded exit `1`) to "Skill-side rules"; mention the test-only `ARCANUM_TTY_DEVICE` override. Update the summary line near the top ("an offer on `/dev/tty`") to mention the fallback.
- `docs/agents/architecture/per-repo-migrations.md`: rewrite the "Preferred convention for script-driven interaction" paragraph. In the runner-chain paragraph, change "TTY-through-a-tool-call is confirmed to work reliably" to "works when the session has a controlling terminal; not guaranteed (see #681)". Note that `run.sh` adopts the fallback in #682.
- `AGENTS.md`: update the script-driven interaction bullet to the new convention.
- `docs/agents/issue-enhancement.md`: update the "Script-driven interaction?" checklist item.
- `docs/agents/architecture.md`: update the Skill Finish row's "the `/dev/tty` next-step offer" wording to mention the fallback.

### Step 2 — Add the fallback check to `skill-reviewer`
In `.claude/agents/skill-reviewer.md`, extend "What to review" with a second check: any skill step that calls a script owning a `/dev/tty` prompt (today `arcanum/_lib/next_step_prompt.sh`; later `arcanum/migrations/run.sh`) must handle exit `4` / `FALLBACK=chat` with an `AskUserQuestion` fallback. Add a matching report format (file, lines, reason). Update the agent's `description` so it's also dispatched for this check, and reflect the widened scope in `docs/agents/architecture/agent-roster-and-delegation.md`'s `skill-reviewer` row if that row describes its checks.

## Files to Change
- `docs/agents/architecture/skill-finish.md` — next-step offer contract and skill-side rules.
- `docs/agents/architecture/per-repo-migrations.md` — preferred convention and the TTY-reliability claim.
- `AGENTS.md` — script-driven interaction bullet.
- `docs/agents/issue-enhancement.md` — "Script-driven interaction?" item.
- `docs/agents/architecture.md` — Skill Finish index row.
- `.claude/agents/skill-reviewer.md` — new exit-`4` fallback check.
- `docs/agents/architecture/agent-roster-and-delegation.md` — `skill-reviewer` row, if needed.

## Notes
- No per-repo migration is needed: nothing changes inside consuming repos.
- Open question kept from the issue: whether `/dev/tty` works in any Claude Code environment (e.g. the plain terminal CLI). The TTY-first design is correct either way; don't claim either answer in the docs.
- `README.md`'s installer/updater `/dev/tty` mentions are out of scope (humans run those from a shell).
