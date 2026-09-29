# Skill-writer Plan: Skill finish: discuss-issue

Main plan: [plan.md](plan.md)

## Shared contracts

You consume `arcanum/_lib/finish_report.sh` and `arcanum/_lib/next_step_prompt.sh` exactly as defined in [plan.md](plan.md#shared-contracts), and the nesting handoff (`NESTED=true`, `--merge` only when a `FINISH_*` block came back). Call the scripts with cross-skill paths relative to the step file, e.g. `../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill discuss-issue ...`. Relay the report's stdout verbatim as the last thing printed before any offer. Never hand-format or paraphrase it.

## Implementation Steps

### Step 1 — Rewrite the ending (`discuss_and_save.md` step 8)

Replace the free-form "Would you like me to start planning this issue now?" and its `confirm.sh` call with this flow:

1. After "Push to GitHub" succeeds, derive the refine label change from `mark-refined`'s output:
   - `created:refined` if it printed `Removed tag 'created'`; likewise `idea:refined` or `writting:refined` if one of those was removed;
   - otherwise `:refined`.
2. Run `next_step_prompt.sh --repo "$REPO_PATH" --command "/auto-plan-issue <id>"`.
3. On `CHOICE=yes`, keep the existing sequence:
   - `checkout_from_main.sh` (with conflict handling);
   - `commit_issue.sh`;
   - `auto-plan-issue/steps/run.md`, now with `NESTED=true`;
   - `git -C "$REPO_PATH" push`;
   - `mark-ready`;
   - `checkout_safe_branch.sh`.

   Then call `finish_report.sh --status success --issue <id> --label-change <refine change> --label-change refined:ready` (plus `--merge "<block>"` if `auto-plan-issue` returned one) and relay the output. Then run `next_step_prompt.sh --command "/auto-fix-issue <id>"`:
   - On `yes`, chain `auto-fix-issue` inline as a top-level run (no `NESTED`), removing the old "do not continue into auto-fix-issue" rule.
   - On `no`, end.
   - On `chat` (exit 3), return to the conversation.
   - On exit 1, say in one line that the prompt was unavailable, then end.
4. On `CHOICE=no`, `CHOICE=chat` (exit 3) or exit 1:
   - call `checkout_safe_branch.sh`;
   - print the push-only `success` report (`--issue <id> --label-change <refine change>`);
   - on exit 1, add the one-line "prompt unavailable" note;
   - on chat, return to the conversation.

   Do not show a second offer.

### Step 2 — Declined and failed exits

- **Declined**: in step 6/7 of `discuss_and_save.md`, add that if the user explicitly abandons the refinement (for example, "stop" or "drop it"), the skill prints `finish_report.sh --status declined --issue <id> --summary "..."` and ends: no push, no label change, no offer, no safe-branch checkout beyond the defensive release. Answering "no" to the comprehension check is not a decline.
- **Failed**: every step that stops the skill ends with `--status failed` and a summary naming the failed step. Include only the links and label changes that actually happened, and show no offer. This covers:
  - `extract_id_and_name.md`: the dirty-tree script error;
  - the push `update` failing;
  - `checkout_from_main.sh`;
  - `commit_issue.sh`;
  - `auto-plan-issue`, including a returned `FINISH_STATUS=failed`, which must be reported as the caller's own `failed` rather than merged into a success;
  - the plan push.

  `mark-refined` and `mark-ready` stay best-effort, not failures.
- Update `discuss-issue/SKILL.md`'s description or step summary if it mentions the old "start planning now?" question.

## Files to Change
- `discuss-issue/steps/discuss_and_save.md`: new ending, nested plan run, report calls and offers
- `discuss-issue/steps/extract_id_and_name.md`: failed report on a script error
- `discuss-issue/SKILL.md`: only if it describes the old ending
- `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md`: adjust the sentence about `discuss-issue`'s step 8 "yes, plan it" / "no" exits if the wording no longer matches

## Notes
- `confirm.sh` stays in use for step 7's comprehension check.
- Wiring `NESTED=true` into `auto-fix-all/steps/process_one_issue.md` is #665's job, not this issue's.
