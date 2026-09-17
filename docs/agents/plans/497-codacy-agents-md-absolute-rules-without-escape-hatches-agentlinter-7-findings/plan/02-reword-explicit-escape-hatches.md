# Reword lines 35 and 40 into explicit escape-hatch phrasing

Keep the same underlying meaning, but phrase each as "never X — unless/if Y, do Z" so Agentlinter recognizes the existing alternative path as an explicit escape hatch:

- **Line 35**: reword to something like `Never hand-edit an auto-generated file — if it needs to change, regenerate it via its` `scripts/generate_*.sh` `instead of editing by hand.` (keep the existing sentence identifying `docs/agents/tag-mutations.md` and `docs/agents/architecture/entrypoint-migration-status.md` as the marked files).
- **Line 40**: reword to something like `Never preapprove broad or ad hoc destructive commands — narrow, fixed, low-risk scripts common to most specialist dispatches are candidates for a permission-grant allowlist entry; agent-specific or ad hoc commands rely on the blocked-dispatch escalation path instead.` (this already matches the bullet's current wording closely — just confirm the "unless X, then Y" shape reads as an explicit hatch, not a buried aside).

## Files to Change

- `AGENTS.md` — reword lines 35 and 40 as above.
