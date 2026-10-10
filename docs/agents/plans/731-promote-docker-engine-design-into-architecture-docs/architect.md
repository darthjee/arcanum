# Architect Plan: Promote docker engine design into architecture docs

Main plan: [plan.md](plan.md)

## Shared contracts

You **produce** `docs/agents/architecture/docker-engine.md` with the section layout and anchors listed in [plan.md → Target doc and anchor mapping](plan.md#target-doc-and-anchor-mapping). Write it first. scripter, infra and node repoint their references at those anchors.

## Steps

- [01 — Write docker-engine.md](architect/01-write-docker-engine-doc.md)
- [02 — Update the other architecture docs](architect/02-update-architecture-docs.md)
- [03 — Update specs.md, AGENTS.md and shell-engine-removal.md](architect/03-update-specs-index-and-agents-md.md)
- [04 — Remove the temporary drift rule from scripter and skill-reviewer](architect/04-remove-drift-rule.md)

## CI Checks

No CI job checks markdown. Run the done check from [plan.md](plan.md#done-check) after all agents finish, and verify every relative link in the touched docs resolves.

## Notes

- Do not delete anything under `docs/agents/specs/` (#732 does that). The spec may keep pointing at itself until then.
- The per-row `credentials`/`mounts`/`env` data in `checklist.md` is **not** carried over. The shims' `--needs`/`--path-arg` declarations and `migration-status.json` are the lasting source of truth.
- If #737 (multi-arch image publishing) or #733 are still open at implementation time, state that plainly in the doc ("not published from CI yet: #737"), rather than describing them as done.
