# Issue: Add Refined Label

## Description
Right now, `discuss-issue`'s "Push to GitHub" step (right after refining the issue) adds the `Ready` label (removing `Created`). Later in that same skill run, once the user confirms planning, `discuss-issue` checks out `issue-<id>`, commits the issue file and the plan (drafted by walking through `auto-plan-issue`'s steps directly), then runs a final `git push` to publish that branch — at which point the issue is ready to be picked up by `auto-fix-all`/`auto-fix-issue` for actual implementation.

## Problem
The issue is marked `Ready` immediately after discussion, before any plan exists — not once it (and its plan) are actually ready to be worked on. This makes the `Ready` label an unreliable signal: it's set too early, right after refinement rather than after planning.

## Solution
- `discuss-issue`'s "Push to GitHub" step: instead of adding `Ready`, add a new `Refined` label (still removing `Created`).
- `discuss-issue`'s step 8 (planning confirmation flow): right at/around the final `git push` that publishes the `issue-<id>` branch with the committed issue + plan, remove the `Refined` label (no-op if not present) and add the `Ready` label — this is the point where the issue is actually ready for `auto-fix-all`/`auto-fix-issue` to pick up.
- `init-claude`'s default label set must also create the `Refined` label when ensuring labels exist, with color `#418193` (`Refined:418193`).

## Benefits
- `Ready` becomes a trustworthy signal that a PR is actually ready for review/merge, not just that the issue text has been discussed and agreed upon.
- `Refined` lets the pipeline and humans browsing issues distinguish "discussed and confirmed" from "implementation complete."
