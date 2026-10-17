# discuss-issue first offer with CLEAR=true

In `discuss-issue/steps/discuss_and_save.md` §8, the `CHOICE=yes` with
`AUTO=true` paragraph gains a `CLEAR=true` branch (a short subsection, e.g.
`### CHOICE=yes with CLEAR=true — hand off planning`):

1. Run plan-it steps 1–2 unchanged (`checkout_from_main.sh`, including the
   conflict handling, then `commit_issue.sh`), with the same fail-with rules.
2. Do **not** run the nested plan, the plan push, `mark-ready` or
   `checkout_safe_branch.sh`: stay on `issue-<id>` so the top-level
   `auto-plan-issue`'s `auto_next.sh` branch check passes.
3. Print the push-only `success` report with
   `--summary "Issue #<id> refined and pushed to GitHub; planning hands off to /auto-plan-issue <id>."`
   and `--label-change <refine change>`.
4. Hand off `/auto-plan-issue <id>` per [Clearing](../../docs/agents/architecture/skill-finish.md#clearing).
   At level 3 (in place), invoke `/auto-plan-issue <id>` as a chained top-level
   run (not the nested plan-it path), so all three levels behave the same.

No second offer on this path: the top-level `auto-plan-issue` makes its own
chaining decision.

## Files to Change
- `discuss-issue/steps/discuss_and_save.md` — first-offer CLEAR branch.
