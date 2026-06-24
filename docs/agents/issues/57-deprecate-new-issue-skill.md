# Issue: Deprecate new-issue skill

## Description
The `new-issue` skill was the original way to create issue files in the project. Now that `discuss-issue` exists, `new-issue` is superseded and should be removed. The `auto-new-issue` skill is unrelated to this change and must be kept.

## Problem
- The `new-issue` skill uses a simpler interactive flow ("Describe me the issue") that is inferior to the richer dialogue loop in `discuss-issue`.
- Having two overlapping skills for issue creation causes confusion about which one to use.

## Solution
- Remove the `new-issue` skill directory (`/skills/new-issue/`) entirely.
- Remove any references to `new-issue` in `AGENTS.md`, `README.md`, or other project documentation.
- Verify that `discuss-issue` covers all use cases previously handled by `new-issue`.
- Do NOT remove or modify `auto-new-issue` — it serves a different purpose (autonomous pipeline) and is out of scope.

## Benefits
- Simpler skill surface: users have one clear entry point for creating and refining issues.
- Avoids maintaining two parallel implementations of the same flow.

---

Tags: :shipit:
