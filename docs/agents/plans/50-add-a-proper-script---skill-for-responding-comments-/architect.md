# Architect Plan: Add a proper script / skill for responding comments

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on `scripter`'s new script and template (already specified in [plan.md](plan.md)'s "Shared contracts" section):

```
../../auto-fix-all/scripts/reply_comment.sh <id> <agent> <model_name> <model_email> <reply_body>
```

(path resolved relative to wherever the calling step file lives — `handle_comment.md` itself lives inside `auto-fix-all/steps/`, so from there the relative path is `../scripts/reply_comment.sh`.)

## Implementation Steps

### Step 1 — Add the question-vs-actionable judgment step

Edit `auto-fix-all/steps/handle_comment.md`. Today its "Choosing the responsible agent(s)" section (numbered list, item 3) only judges *which agent* is responsible. Add a judgment immediately before/alongside it: for each comment, first decide whether it reads as a question/clarification request (no code change implied) or an actionable request (a code change, fix, or feature is being asked for).

- If it is a **question**, skip the "Choosing the responsible agent(s)" / "Dispatching" flow for that comment entirely and go to the new "Replying to a question" section below instead.
- If it is **actionable**, proceed exactly as today (unchanged).

This judgment applies only to the `commented` branch of [process_one_issue.md](../../auto-fix-all/steps/process_one_issue.md) (i.e. real PR comments) — it does not apply to the CI-failure branch, which is always actionable by definition. Make sure the existing text that currently says "For each comment (or failed check-run name):" is scoped so the new judgment step is clearly comment-only.

### Step 2 — Add the "Replying to a question" section

Add a new section to `handle_comment.md` describing the reply path:

1. Decide which agent should answer, using the same agent-selection reasoning as "Choosing the responsible agent(s)" (compare the comment against each candidate agent's description; fall back to `architect` if none seem responsible).
2. Draft the reply body addressing the question (the responsible agent, or you as architect, writes this — it is a judgment call, not scripted).
3. Post it:
   ```bash
   ../scripts/reply_comment.sh <id> <agent> "<your AI model name>" "<your AI model noreply email>" "<reply body>"
   ```
   (resolved relative to `auto-fix-all/steps/`, i.e. the script lives at `auto-fix-all/scripts/reply_comment.sh`).
4. No commit, no push, no CI wait for a question reply — go straight back to "Monitor the PR" (top of [process_one_issue.md](../../auto-fix-all/steps/process_one_issue.md)) to resume monitoring, same re-entry point used after the existing dispatch-and-commit flow finishes, but skipping the push/commit since nothing changed in the working tree.

Be explicit that if a single `commented` batch contains a mix of question and actionable comments, each comment is routed independently (some replied to directly, others dispatched-and-committed) before returning to "Monitor the PR" once, after all of them are handled.

### Step 3 — Cross-check process_one_issue.md

Read `auto-fix-all/steps/process_one_issue.md`'s `### If \`commented\`` section (the one that reads `handle_comment.md` and says "After all comments are handled and pushed, go back to..."). Update its wording only if needed so it still makes sense when some/all comments in the batch were pure replies with nothing to push (e.g. "After all comments are handled — pushing any code changes made — go back to...").

## Files to Change

- `auto-fix-all/steps/handle_comment.md` — add question-vs-actionable judgment + new "Replying to a question" section
- `auto-fix-all/steps/process_one_issue.md` — minor wording tweak in the `commented` section if needed, to not imply a push always happens

## Notes

- Do not implement `reply_comment.sh` or `reply.tmpl.md` yourself — that is `scripter`'s deliverable per [scripter.md](scripter.md). Wait for it (or write the calling instructions against the agreed contract even if scripter's commit lands in a different step of the dev cycle) before finalizing the exact script invocation line, in case the args change during scripter's manual sanity-check (Step 3 of scripter.md).
- Keep all path references relative, never absolute, per this repo's conventions (see `AGENTS.md`).
