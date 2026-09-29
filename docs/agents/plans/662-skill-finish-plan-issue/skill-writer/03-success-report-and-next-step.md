# Success report and next-step offer

## What to change

In `plan-issue/steps/write_and_confirm.md`, after "Commit and publish the plan", add two sections.

**`## Success report`**

Run the following and relay its output verbatim:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue --status success --issue <id> \
  --summary "Plan written and committed for issue #<id>." [--label-change refined:ready]
```

- Pass `--label-change refined:ready` only if `mark-ready` succeeded.
- Use the same summary text whether the plan is new or existing.

**`## Next step: auto-fix-issue`**

Run the following:

```bash
../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/auto-fix-issue <id>"
```

Handle the result as follows:
- `CHOICE=yes`: invoke `/auto-fix-issue <id>` inline, in the same session, as a chained top-level run with no `NESTED=true`.
- `CHOICE=no`: end.
- `CHOICE=chat` (exit 3): return to the conversation. Do not run `auto-fix-issue` unless the user asks for it.
- exit 1: say in one line that the next-step prompt was unavailable, then end.

Never re-ask in chat, and never change the command that was shown. The old chat question "Would you like to proceed and open a PR to fix this issue now?" is removed entirely.

In `plan-issue/SKILL.md`:
- add the `REPO_PATH` resolution line, matching `discuss-issue/SKILL.md`;
- update the `description` frontmatter and Step 3's text so they say the confirmed plan is committed, pushed and marked `Ready`, and that the skill ends with the standard closing report and `/auto-fix-issue` offer.

## Files to Change
- `plan-issue/steps/write_and_confirm.md`: add the Success report and Next step sections.
- `plan-issue/SKILL.md`: add `REPO_PATH` resolution, and update the description and Step 3 wording.
