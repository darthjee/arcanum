# scripter Plan: Codacy: misc markdownlint singles — MD012/MD025/MD036/MD038/MD047 (5 findings)

Main plan: [plan.md](plan.md)

## Shared contracts

- Consumes the new filename `init-claude/setup_specialist_dispatch_permissions.md`, created by `skill-writer` (see [plan.md](plan.md)'s Shared contracts) as the split-out target for the "Common Specialist-Dispatch Permission Exemption" procedure that used to live inside `init-claude/setup_permissions.md`.

## Implementation Steps

### Step 1 — Update permission_grant.sh's "Used by" comment

`arcanum/_lib/permission_grant.sh`'s header comment has a "Used by" bullet reading `init-claude/setup_permissions.md's onboarding step, which calls this file's own CLI dispatcher directly...`. Both post-split files (`init-claude/setup_permissions.md` and the new `init-claude/setup_specialist_dispatch_permissions.md`) use this same direct-invocation CLI pattern, so reword the bullet to name both onboarding steps instead of just the one file.

### Step 2 — Update permission_grant_shell.sh's equivalent comment

`arcanum/_lib/permission_grant_shell.sh` has the same "Used by" bullet shape, referencing `init-claude/setup_permissions.md's onboarding step`. Apply the same fix as Step 1: reword to name both onboarding steps.

## Files to Change

- `arcanum/_lib/permission_grant.sh` — reword the "Used by" bullet mentioning `init-claude/setup_permissions.md`'s onboarding step to name both `init-claude/setup_permissions.md` and `init-claude/setup_specialist_dispatch_permissions.md`.
- `arcanum/_lib/permission_grant_shell.sh` — same reword as above, in its own equivalent "Used by" bullet.

## Notes

- Do not touch `auto-fix-all/scripts/wait_ci_and_merge_shell.sh`'s comment referencing `init-claude/setup_permissions.md` — verified during exploration that comment is scoped to the `shipit`-merge exemption only, which stays in the unsplit `setup_permissions.md`.
