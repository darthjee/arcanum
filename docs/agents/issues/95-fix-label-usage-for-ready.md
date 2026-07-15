# Issue: Fix label usage for Ready

## Description
The `monitor-issues` skill currently treats the `Ready` GitHub label as the signal that an issue is ready to be enqueued for automated processing (the `clipboard` canonical tag, mapped in `_lib/tags.sh`). In practice, developers also use `Ready` to mean "this task is well-defined," without necessarily meaning it should be picked up by the pipeline right away. The two meanings collide.

## Problem
Because `Ready` is overloaded, an issue can get auto-enqueued into `auto-fix-all` as soon as a developer marks it well-defined, even if it isn't meant to be worked on yet.

## Solution
- Add a new label `Ready for Work` (color `ffaa04`) to `init-claude/scripts/lib/label_config.sh`'s `DEFAULT_LABEL_PAIRS`.
- In `_lib/tags.sh`, repoint the `clipboard` canonical tag from the `Ready` label to the new `Ready for Work` label, in both `_tag_label_for` and `_tag_for_label`.
- The `Ready` label itself is NOT removed from `init-claude`'s default labels — developers can keep using it to mean "well-defined." It simply stops being mapped to any canonical tag, so `monitor-issues` no longer acts on it.
- Update `docs/agents/architecture.md`'s Issue Tags table (`clipboard` | `Ready`) and the `clipboard` tag description to reflect the new `Ready for Work` label.

### Out of scope
No migration for issues already open with the old `Ready` label — they simply won't be auto-enqueued anymore until someone manually adds `Ready for Work`. No bulk-relabeling script is needed.
