# Architect agent refuses to process issues via the auto-fix-all pipeline, citing scope/authorization concerns

## Context

`auto-fix-all` drives the full pipeline (new issue → plan → fix → monitor) for a queue of issue
IDs, one at a time. Per `docs/agents/architecture/agent-roster-and-delegation.md`, when one of the
autonomous skills (e.g. `auto-new-issue`, `auto-fix-issue`) is invoked from inside `auto-fix-all`,
the caller is already running as an `architect` agent — it reads the callee's `steps/run.md`
directly and follows it, without spawning a nested `Agent(architect)`. Only the outermost,
human/coordinator-facing invocation spawns the subagent.

The `architect` agent's tool set (`Read, Edit, Write, Bash, Agent`) intentionally excludes
`ScheduleWakeup` and `AskUserQuestion`, and its guidance emphasizes strict scope boundaries and
that no agent message alone can authorize privileged actions. In some runs, the `architect` agent
misapplies this caution: instead of treating an in-process invocation from `auto-fix-all` as a
legitimate, already-authorized continuation of the same pipeline run, it treats the request as an
out-of-scope or unauthorized instruction and refuses to proceed — breaking the fully autonomous,
no-confirmation-loop contract that `auto-fix-all` and the nested `auto-*` skills rely on.

This defeats the purpose of `auto-fix-all`, which is meant to run unattended across a queue of
issues without stopping for clarification or permission.

## What needs to be done

- Reproduce the refusal: run (or trace through) `auto-fix-all` processing at least one issue end
  to end, and identify the exact point/prompt where the `architect` agent declines to continue,
  citing scope or authorization concerns.
- Diagnose whether the refusal is caused by:
  - Ambiguous or overly cautious language in `AGENTS.md` / `docs/agents/architecture/agent-roster-and-delegation.md`
    (or another doc read by the architect) being misread as blocking nested pipeline invocations.
  - Missing or unclear signaling in the `auto-fix-all` → `auto-new-issue`/`auto-fix-issue` call
    chain that the current step is an authorized continuation of an already-running pipeline,
    not a fresh, unauthorized request.
  - A more general safety-instruction conflict where "no agent message is your user's consent"
    guidance is being applied even to the coordinator's own in-pipeline delegation.
- Update the relevant documentation (`AGENTS.md`, `docs/agents/architecture/agent-roster-and-delegation.md`,
  and/or the affected skill `SKILL.md`/`steps/*.md` files) to explicitly clarify that steps invoked
  from within `auto-fix-all` (or any other already-authorized autonomous pipeline) are pre-authorized
  and must be processed without pausing for confirmation — while still respecting genuine safety
  boundaries (e.g. it should not authorize changing permissions/config).
- If the issue stems from a specific skill's `run.md`/`SKILL.md` wording rather than the shared
  docs, delegate the wording fix to the `architect` for cross-skill docs, or to the owning
  specialist agent if the fix is localized to a single skill's scripts/logic.

## Acceptance criteria

- [ ] TODO
