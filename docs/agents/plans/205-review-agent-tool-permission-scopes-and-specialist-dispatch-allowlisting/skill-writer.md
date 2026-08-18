# Skill-Writer Plan: Review agent tool-permission scopes and specialist-dispatch allowlisting

Main plan: [plan.md](plan.md)

## Shared contracts

Same three pattern strings `scripter` is provisioning via migrations — keep these byte-identical to what ends up in `arcanum/migrations/repos/next/003.sh` (the repo-tier script, since this onboarding step also targets the shared, committed `.claude/settings.json`):

```
Bash(auto-fix-issue/scripts/commit_change.sh *)
Bash(auto-fix-issue/scripts/run_checks.sh *)
Bash(git add *)
```

## Implementation Steps

### Step 1 — Add a second step to `init-claude/setup_permissions.md`

`init-claude/setup_permissions.md` currently has one "Setup the `shipit`-Merge Permission Exemption" flow (ask → explain → write, targeting `.claude/settings.json`). Add a second, parallel flow for this bundle, following the exact same three-step shape:

- **Ask**: `Would you like to grant the common specialist-dispatch scripts (commit_change.sh, run_checks.sh) and git add permission to run without confirmation, in this repo's shared .claude/settings.json (committed, visible to all contributors)? [y/n]`
- **Explain** (if not already seen, e.g. via the paired `arcanum/migrations/repos/next/003.md` prompt): every specialist agent dispatched by `auto-fix-issue`/`auto-fix-all` runs `auto-fix-issue/scripts/run_checks.sh` and `auto-fix-issue/scripts/commit_change.sh` (plus a plain `git add` beforehand) on every commit it makes — without this exemption, autonomous runs risk stopping at that step to ask for confirmation. This bundle does not exempt any other Bash command, git/gh write operations in general, or any specialist's own ad hoc implementation commands (e.g. build/test tooling) — see `docs/agents/architecture/dispatch-permissions.md` for the full policy this generalizes from.
- **Write** (on yes): three `permission_grant.sh add .claude/settings.json "<pattern>"` calls (one per pattern above), resolved the same way the existing step resolves `../arcanum/_lib/permission_grant.sh` relative to the `init-claude` skill folder.

### Step 2 — Cross-reference

If `init-claude/SKILL.md` (or any other step file) enumerates `setup_permissions.md`'s steps by name/count, update that listing to reflect the new step. Otherwise no other file needs to change.

## Files to Change

- `init-claude/setup_permissions.md` — add the second onboarding flow (Step 1 above).
- `init-claude/SKILL.md` — update only if it itemizes `setup_permissions.md`'s steps explicitly (check before editing).

## Notes

- Match `setup_permissions.md`'s existing tone/structure exactly (ask/explain/write headers, the same "Resolve `../arcanum/_lib/permission_grant.sh` relative to the `init-claude` skill folder" phrasing) rather than introducing a new shape for this second flow.
- Coordinate with `scripter` (through `architect`) if the pattern strings change during implementation — they must stay identical to what `arcanum/migrations/repos/next/003.sh` grants.
