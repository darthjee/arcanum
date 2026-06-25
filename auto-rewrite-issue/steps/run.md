You are the **architect**. Your job is to drain the `monitor-issues` rewrite queue, fully autonomously — no questions to the user, no confirmation loop. Follow the steps below precisely and in order.

## Step 1 — Drain the queue

Loop:

```bash
../monitor-issues/scripts/rewrite_queue.sh pop
```

> Resolve `../monitor-issues/scripts/rewrite_queue.sh` relative to the `auto-rewrite-issue` skill folder.

- **Exit 0:** stdout is exactly the popped issue id (one line, no other output). Process it per Step 2, then loop back to call `pop` again.
- **Exit 1 (no stdout):** the queue is empty — stop looping and go to Step 3.

## Step 2 — Process one popped id

For the id popped in Step 1:

1. **Fetch the current body.**

   ```bash
   gh issue view <id> --json body -q .body
   ```

   This is a one-off, low-reuse call — call `gh` directly rather than adding a wrapper command.

   If this fails, log the failure and move on to the next id (back to Step 1) — do not retry and do not re-push to the queue (see the note at the end of this step for why).

2. **Draft the rewritten body.** Apply the same judgment `discuss-issue/steps/discuss_and_save.md` step 2 uses — draft Description/Problem/Expected Behavior/Solution/Benefits sections (only the ones relevant to this issue) from the current content — but fully autonomous: skip any clarifying questions and skip the "Did I comprehend the issue?" loop entirely. Always write in English, translating if the fetched content is in another language.

   If the body ends with a trailing `---` / `Tags:` block, preserve it verbatim in the rewritten body — do not hand-edit it here. Removing the `pencil2` tag itself happens in sub-step 4 below, not as part of this rewrite.

3. **Push the rewritten body.** Write the drafted body to a temp file, then:

   ```bash
   gh issue edit <id> --body-file <tmpfile>
   ```

   This is a one-off, low-reuse call — call `gh` directly rather than adding a wrapper command. If this fails, log the failure and move on to the next id (back to Step 1) — do not remove the tag (next sub-step) if the push failed, and do not re-push to the queue.

4. **Remove the `pencil2` tag.**

   ```bash
   ../monitor-issues/scripts/github.sh remove-tag <id> pencil2
   ```

   > Resolve `../monitor-issues/scripts/github.sh` relative to the `auto-rewrite-issue` skill folder.

   If this fails, log the failure — the body was already rewritten on GitHub, but the tag remains, so a future poll will detect `pencil2` again and re-queue the id, triggering a re-rewrite (harmless, just redundant work).

Note on failures: on any failure in this sequence (fetch, rewrite, push, or tag removal), do not re-push the id to the queue from here. `monitor-issues` never recorded this issue's `updated_at` while `pencil2` was pending (it only writes `updated_at` after a successful push to the queue, not after the rewrite completes), so the next `monitor_issues.sh` poll will still see the GitHub `updatedAt` as newer than the stored value, re-detect the `pencil2` tag, and re-push the id on its own.

## Step 3 — Report

Once the queue is drained (Step 1 returns exit 1 with no further ids), report a summary: how many ids were processed successfully, and which ids (if any) failed and at which sub-step (fetch, rewrite/push, or tag removal).
