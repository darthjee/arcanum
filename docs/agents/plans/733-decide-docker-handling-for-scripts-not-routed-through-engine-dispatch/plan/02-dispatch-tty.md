# Resolve the non-dispatched TTY line in dispatch.md

`docs/agents/specs/docker/dispatch.md:199` currently says non-dispatched TTY scripts "stay with #733". Replace it with the decision. `next_step_prompt.sh` never reaches dispatch today, so under `engine.mode=docker` it keeps prompting on the host's real `/dev/tty`. It must not move into the container, because that would turn every next-step offer into the `AskUserQuestion` fallback. Its migration to a dispatched native command, together with `auto_next.sh`, keeps it out of the container by giving it the `"host-only"` status in `migration-status.json` (#760). Link to the `host-only` row of the resolution table.

Add a short `## Scripts not routed through dispatch` section (after `## TTY`, or next to `## Native-only commands`) that gives the per-kind rule in one table, with the same four kinds and meanings as the checklist (`sourced`, `wrapper`, `entrypoint`, `bootstrap`), and says none can be ✅. The checklist's last-section intro (step 01) links here.

## Files to Change
- `docs/agents/specs/docker/dispatch.md`: replace the "stay with #733" line in `## TTY` and add the non-dispatched scripts section.
