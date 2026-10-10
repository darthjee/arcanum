# Update the index and sibling parts

Bring the rest of the spec in line with what steps 01–02 decided.

- `docs/agents/specs/docker.md`:
  - **Status:** say dispatch and testing are written (#727), so phase 1 is done except #733.
  - **Decisions so far:** replace "a separate decision (#727)" with the `migration-status.json` decision.
  - **Open points:** mark TTY, Performance (default chosen, measured in #729), Docker-readiness source of truth, Nested calls (dispatch half), Exit codes and streams, Concurrency and Host-only commands as resolved, each linking its `dispatch.md` anchor.
  - **Sub-issue map:** set #727 to Done.
  - **Parts table:** keep the purpose text accurate.
- `docs/agents/specs/docker/checklist.md`: update the "How to use it" text that points at #727 for the readiness lookup, so it names the `migration-status.json` value and the rule that ticking ✅ flips it. Add a `notes` hint for the TTY rows (exit 4 `FALLBACK=chat` under docker) if useful.
- `docs/agents/specs/docker/mounts.md` (Argument paths: "How the shim tells dispatch … is part of dispatch.md (#727)") and `docs/agents/specs/docker/environment.md` (Nested-call marker: "belong to dispatch.md (#727)"): turn these forward references into links to the new `dispatch.md` anchors. Change nothing else unless a decision in step 01 contradicts them.

## Files to Change

- `docs/agents/specs/docker.md` — status, decisions, open points, sub-issue map.
- `docs/agents/specs/docker/checklist.md` — readiness rule wording, TTY notes.
- `docs/agents/specs/docker/mounts.md` — link the argument-path forward reference.
- `docs/agents/specs/docker/environment.md` — link the nested-call forward reference.
