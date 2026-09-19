# Update dispatch-permissions.md references to the split filename

`docs/agents/architecture/dispatch-permissions.md` references `init-claude/setup_permissions.md` twice, and both are specifically about the "Common Specialist-Dispatch Permission Exemption" procedure that `skill-writer` is moving into the new `init-claude/setup_specialist_dispatch_permissions.md` (see [plan.md](../plan.md)'s Shared contracts):

- Around line 75: "...plus a second onboarding step in `init-claude/setup_permissions.md` for freshly onboarded repos — the same three-tier + onboarding shape `shipit`'s `wait_ci_and_merge.sh` exemption used" — update the filename to `init-claude/setup_specialist_dispatch_permissions.md`.
- Around line 85: "...plus an `init-claude/setup_permissions.md` onboarding step, mirroring this issue and the `shipit` precedent it generalizes" — this one is generic forward-looking policy guidance (for future specialist/dispatch permission additions), so update the filename reference the same way since it's still citing this exact procedure as its concrete example.

Do not touch `docs/agents/architecture/issue-tags.md`'s `setup_permissions.md` mention (line 24) — that paragraph is entirely about the unrelated `shipit`-merge exemption, which stays in `init-claude/setup_permissions.md` unchanged.

## Files to Change

- `docs/agents/architecture/dispatch-permissions.md` — update both `init-claude/setup_permissions.md` references (around lines 75 and 85) to `init-claude/setup_specialist_dispatch_permissions.md`.
