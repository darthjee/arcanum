# Architect Plan: Create-issue: native command

Main plan: [plan.md](plan.md)

## Shared contracts

- Consumes the final command names, shim paths and output contract from [plan.md](plan.md).

## Implementation Steps

### Step 1 — Update architecture docs

In `docs/agents/architecture/script-engine.md`'s "Native-only entrypoints" section, list the
`arcanum-create-issue-start` / `-publish` commands alongside `/arcanum-check-config`. Update
`docs/agents/folder-structure.md` if it enumerates skill folders/scripts.

### Step 2 — Update the spec

In `docs/agents/specs/arcanum-create-issue.md`: mark the native commands as implemented in the
Status section, resolve the "Default color for auto-created labels" open point (`ededed`), and
record the prompt-5 No/Chat output that `node` chose.

## Files to Change

- `docs/agents/architecture/script-engine.md` — native-only list
- `docs/agents/folder-structure.md` — only if it lists skill scripts
- `docs/agents/specs/arcanum-create-issue.md` — status, open point, prompt-5 output

## Notes

- `tag-mutations.md` / `issue-tags.md` `shipit` rewording is listed under "Label rules" in the
  spec but is not assigned to #690 by the issue; leave it to #691/#693 unless trivially required.
