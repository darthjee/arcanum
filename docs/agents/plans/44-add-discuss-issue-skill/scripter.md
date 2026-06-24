# Scripter Plan: Add Discuss Issue Skill

Main plan: [plan.md](plan.md)

## Shared contracts

- `discuss-issue/scripts/github.sh` — must be copied verbatim from `new-issue/scripts/github.sh`. Commands: `info`, `fetch <id>`, `update <id> <title> <file>`, `create <title> <file>`.
- `discuss-issue/scripts/resolve_id_and_file.sh` — must be copied verbatim from `new-issue/scripts/resolve_id_and_file.sh`. Output: `SCENARIO`, `ID`, `TITLE`, `FILE`, `STATUS`, `NEEDS_FETCH`.

## Implementation Steps

### Step 1 — Create discuss-issue/scripts/ directory

Ensure the `discuss-issue/scripts/` directory exists.

### Step 2 — Copy github.sh

Copy `new-issue/scripts/github.sh` to `discuss-issue/scripts/github.sh` verbatim. Make it executable (`chmod +x`).

### Step 3 — Copy resolve_id_and_file.sh

Copy `new-issue/scripts/resolve_id_and_file.sh` to `discuss-issue/scripts/resolve_id_and_file.sh` verbatim. Make it executable (`chmod +x`).

## Files to Change

- `discuss-issue/scripts/github.sh` — create (copied from `new-issue/scripts/github.sh`)
- `discuss-issue/scripts/resolve_id_and_file.sh` — create (copied from `new-issue/scripts/resolve_id_and_file.sh`)

## Notes

- Copy verbatim — do not modify. The issue explicitly states these are not symlinks so that `new-issue` can be deprecated later without breaking `discuss-issue`.
- Ensure executable bit is set on both scripts after copying.
