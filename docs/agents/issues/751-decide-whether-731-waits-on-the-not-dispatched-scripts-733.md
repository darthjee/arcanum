# Issue: Decide whether #731 waits on the not-dispatched scripts (#733)

## Description

Part of epic #724 (implement `engine.mode=docker`). Surfaced while refining #731 (promote the docker engine design into the architecture docs).

#731 starts once every entrypoint is ticked in `docs/agents/specs/docker/checklist.md`. The checklist's last section, "Not routed through dispatch (pending #733)", lists the scripts that do not go through `engine_dispatch.sh`: 39 rows, each with kind `TBD (#733)`. These rows already have status `n/a`, so "every row ✅ or `n/a`" is already true for them. What is still open is their **kind**, and the per-kind docker behaviour that #733 has to decide.

## Problem

#733 records its decision in the docker spec (`docs/agents/specs/docker/`) and in `checklist.md`. #731 moves the permanent design into `docs/agents/architecture/docker-engine.md`, and #732 then deletes the spec, checklist included. If #731 and #732 land before #733, #733's planned destination no longer exists. Nothing currently states the order between the three sub-issues.

## Expected Behavior

Decision: **#731 waits on #733.** The order is #733 → #731 → #732.

- #733 records its decision where it already plans to: the docker spec, and the checklist's "Not routed through dispatch" section (each row gets a real kind, with status ✅, `n/a`, or `n/a` + `host-only`).
- #731 then promotes that decision into `docs/agents/architecture/docker-engine.md` together with the rest of the design. No retargeting and no follow-up issue.
- #731's gate is: every checklist row (dispatched, native-only, and not-dispatched) is ✅ or `n/a`, **and** no row has kind `TBD (#733)`. The last dispatched row, `permission-grant-add` (#753), is still part of that gate on its own.

## Solution

Issue-tracker changes only. No repo docs change in this issue.

- **#731 body:** replace "Whether it also waits on the scripts not routed through dispatch (#733) is decided in #751" with a statement that it depends on #733, and that the gate includes no `TBD (#733)` kind remaining. In its "Out of scope" list, replace the #751 bullet the same way. Mention that `docker-engine.md` must cover #733's per-kind decision.
- **#733 body:** state that #731 is blocked on it, so its decision lands in the spec and checklist before the promotion.
- **#732:** no body change needed (it already depends on #731, which now transitively waits on #733).
- **GitHub dependencies:** mark #731 as blocked by #733 (and by #753, if not already linked).

## Related

- #733: Decide docker handling for scripts not routed through engine_dispatch.
- #731: Promote docker engine design into architecture docs.
- #732: Remove docker spec docs (depends on #731).
- #753: the last unticked dispatched row (`permission-grant-add`).

## Benefits

- #733 needs no retargeting, and its decision reaches the architecture docs through the normal promotion in #731.
- The spec deletion (#732) stays a pure removal, with no undecided rows left in it.

## Owner

architect
