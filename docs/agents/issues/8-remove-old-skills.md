# Remove old skills

## Context

The skills `check-plan`, `fix-issue`, and `new-plan` are no longer needed in this repository — superseded by the current `new-issue`/`plan-issue`/`fix-issue` family and their `auto-*` counterparts (or simply obsolete), and should be deleted to keep the skills collection clean.

## What needs to be done

- Remove the skill folders `check-plan/`, `fix-issue/`, and `new-plan/` entirely, including any `SKILL.md`, `steps/*.md`, and `scripts/*.sh` they contain.
- Remove any references to these three skills from project-level documentation (e.g. `README.md`, `docs/agents/folder-structure.md`) so nothing dangling points at them.
- `plan-issue/steps/write_and_confirm.md` currently tells the user, after confirming a plan, to invoke `/fix-issue <id>` — update this to no longer point at the removed skill (e.g. point at `/auto-fix-issue <id>` instead, or drop the auto-invocation suggestion entirely — decide during implementation).
- `.claude/agents/architect.md` uses `fix-issue/` as an example path in its scope description — update the example to reference a skill that still exists.
- Double-check no other skill (e.g. an `auto-*` skill or `init-claude`) links to or depends on files inside these three folders before deleting.

## Acceptance criteria

- [ ] `check-plan/`, `fix-issue/`, and `new-plan/` no longer exist in the repository.
- [ ] No remaining references to these three skills in `README.md` or `docs/agents/`.
- [ ] No other skill is broken by the removal (no dangling relative links or slash-command references to deleted files/skills).

---
See issue for details: https://github.com/darthjee/arcanum/issues/8
