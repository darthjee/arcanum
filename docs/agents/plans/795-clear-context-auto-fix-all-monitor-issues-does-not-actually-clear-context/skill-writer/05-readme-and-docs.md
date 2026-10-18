# Correct README and architecture docs

- `README.md` key table:
  - `auto-fix-all.clear_context`: "Clears context between issues in the
    `auto-fix-all` pipeline through the `arcanum-next-step` mod (run via `/loop`);
    without the mod, restarts via a wakeup that keeps context."
  - `monitor-issues.clear_context`: same for `monitor-issues` cycles.
  - If the README's mod section (around line 100–110) lists which skills call the
    mod, add `auto-fix-all` and `monitor-issues` (with `clear_context` on).
- `arcanum-next-step/README.md`, "Status" section: it lists the skills that call
  the tool. Add `auto-fix-all` and `monitor-issues` when their `clear_context` is
  on. This is a text-only edit to the mod's README, so the `mod` agent's code is
  untouched.
- `docs/agents/architecture/shared-state-and-configuration.md`: the
  `arcanum-config.json` and `monitor-issues-config.json` rows only name the toggle.
  Where they describe its effect, align the wording with the above. Add nothing if
  they make no claim.
- Finally, re-run
  `grep -rn -i "clear_context\|clear context\|fresh context" --include=*.md .`
  (excluding `docs/agents/issues`, `docs/agents/plans` and
  `arcanum/migrations/`) and fix any remaining claim that the toggles clear
  context without the mod.

## Files to Change

- `README.md` — `clear_context` key rows, and the mod section if it lists callers.
- `arcanum-next-step/README.md` — "Status" caller list.
- `docs/agents/architecture/shared-state-and-configuration.md` — toggle wording,
  if any claim is made.
