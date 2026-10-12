# Plan: Decide whether #731 waits on the not-dispatched scripts (#733)

Issue: [751-decide-whether-731-waits-on-the-not-dispatched-scripts-733.md](../../issues/751-decide-whether-731-waits-on-the-not-dispatched-scripts-733.md)

## Overview

Record the decision "#731 waits on #733" (order #733 → #731 → #732) wherever #731 and #733 currently point at #751 for it. This is mostly issue-tracker work: GitHub issue bodies and dependency links, plus the #731 issue/plan files committed on branch `issue-731`. No repo docs, spec, or code change on `main`.

## Context

- The checklist's "Not routed through dispatch (pending #733)" section has 39 rows. All of them already have status `n/a`, but their kind is `TBD (#733)`.
- #731's GitHub body, its issue file, and its plan (on remote branch `issue-731`, no PR yet) all say the #733 gate "is decided in #751".
- #733 plans to record its decision in `docs/agents/specs/docker/` and `checklist.md`. That stays valid, because #733 now lands before #731 promotes the spec and before #732 deletes it.
- #753 (`permission-grant-add`, the last ☐ dispatched row) already gates #731 under the existing rule.

## Implementation Steps

### Step 1 — Update the #731 and #733 GitHub issues and dependency links

- **#731 body** (`gh issue view 731` → edit → `gh issue edit 731 --body-file`):
  - Description: replace "Whether it also waits on the scripts not routed through dispatch (#733) is decided in #751." with: it also depends on #733. The gate is that every checklist row (dispatched, native-only, and not-dispatched) is ✅ or `n/a`, and no row still has kind `TBD (#733)`.
  - Expected Behavior: add that `docker-engine.md` covers #733's per-kind decision for scripts not routed through dispatch.
  - Out of scope: drop the bullet "Deciding whether this issue waits on #733's not-dispatched scripts: #751."
- **#733 body:** add a line saying #731 (promotion) is blocked on it, so its decision lands in the spec and checklist before they are promoted and deleted.
- **#732:** no change. It depends on #731, so it now waits on #733 through #731.
- **Dependencies:** mark #731 as blocked by #733 and by #753 through the GitHub issue-dependencies API. Each call takes the blocking issue's numeric `id`, not its number:

  ```bash
  id=$(gh api repos/darthjee/arcanum/issues/733 --jq .id)
  gh api -X POST repos/darthjee/arcanum/issues/731/dependencies/blocked_by -F issue_id="$id"
  ```

  Repeat with #753. If the API is unavailable, fall back to a "Blocked by #733, #753" line in the #731 body.

### Step 2 — Update #731's issue file and plan on branch `issue-731`

On `issue-731` (remote branch with the issue and plan commits, no PR yet), mirror Step 1:

- `docs/agents/issues/731-promote-docker-engine-design-into-architecture-docs.md`: line 7 and the Out of scope bullet on line 55, same wording as the GitHub body.
- `docs/agents/plans/731-promote-docker-engine-design-into-architecture-docs/plan.md` line 9 (Gate): replace the "decided in #751" sentence with the full gate (all rows ✅/`n/a`, no `TBD (#733)` kind left, so #733 merged).
- `docs/agents/plans/731-.../architect/01-write-docker-engine-doc.md`: add that `docker-engine.md` includes a section on scripts not routed through dispatch, carrying over #733's per-kind decision (sourced libraries / wrappers / non-dispatched entrypoints / install-update bootstraps).

Commit on `issue-731` and push. If `issue-731` already has an open PR or is being worked on by another session when this runs, leave a comment on #731 with the change instead of pushing to its branch.

## Files to Change

- GitHub issues #731 and #733 (bodies), plus #731's blocked-by links.
- `docs/agents/issues/731-promote-docker-engine-design-into-architecture-docs.md` (branch `issue-731`): replace the #751 references.
- `docs/agents/plans/731-promote-docker-engine-design-into-architecture-docs/plan.md` (branch `issue-731`): update the gate line.
- `docs/agents/plans/731-promote-docker-engine-design-into-architecture-docs/architect/01-write-docker-engine-doc.md` (branch `issue-731`): cover #733's decision.

## Notes

- The `issue-751` branch itself only carries this issue and plan file. The PR for #751 is just a record of the decision.
- #731 is currently labelled `Working`. Check that nobody is actively implementing it before pushing to `issue-731`.
- No spec or checklist edits: the user chose "update issues + deps" only.
