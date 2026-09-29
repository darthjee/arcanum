# Drain the Monitor-Issues Rewrite Queue

You are the **architect**. Your job is to drain the `monitor-issues` rewrite queue, fully autonomously — no questions to the user, no confirmation loop. Follow the steps below precisely and in order.

`REPO_PATH` (the target project's root) is carried in from your invocation prompt — thread it through to every script call below that resolves the GitHub repo.

Every exit ends with the closing report defined in [Step 3 — Closing report](#step-3--closing-report).

## Step 1 — Drain the queue

Loop:

```bash
../monitor-issues/scripts/rewrite_queue.sh pop
```

> Resolve `../monitor-issues/scripts/rewrite_queue.sh` relative to the `auto-rewrite-issue` skill folder.

- **Exit 0:** stdout is exactly the popped issue id (one line, no other output). Process it per Step 2, then loop back to call `pop` again.
- **Exit 1 (no stdout):** the queue is empty — stop looping and go to Step 3. (`pop` also exits 1 on error, so an unreadable queue looks the same as an empty one. Do not treat it separately.)

## Step 2 — Process one popped id

For the id popped in Step 1, record its outcome as you go. Step 3 builds the closing report from these records, in processing order:

- **rewritten**: the body push (sub-step 3) succeeded;
- **tag removed**: the `remove-tag ... created` call (sub-step 4) also succeeded;
- **failed at `<sub-step>`**: `fetch` (sub-step 1), `rewrite/push` (sub-steps 2–3), or `tag removal` (sub-step 4). A `tag removal` failure still counts as **rewritten**, since the body is already on GitHub.

1. **Fetch the current body.**

   ```bash
   gh issue view <id> --json body -q .body
   ```

   This is a one-off, low-reuse call — call `gh` directly rather than adding a wrapper command.

   If this fails, log the failure and move on to the next id (back to Step 1) — do not retry and do not re-push to the queue (see the note at the end of this step for why).

2. **Draft the rewritten body.** Apply the same judgment `discuss-issue/steps/discuss_and_save.md` step 2 uses — draft Description/Problem/Expected Behavior/Solution/Benefits sections (only the ones relevant to this issue) from the current content — but fully autonomous: skip any clarifying questions and skip the "Did I comprehend the issue?" loop entirely. Always write in English, translating if the fetched content is in another language.

3. **Push the rewritten body.** Write the drafted body to a temp file, then:

   ```bash
   gh issue edit <id> --body-file <tmpfile>
   ```

   This is a one-off, low-reuse call — call `gh` directly rather than adding a wrapper command. If this fails, log the failure and move on to the next id (back to Step 1) — do not remove the tag (next sub-step) if the push failed, and do not re-push to the queue.

4. **Remove the `created` tag.**

   ```bash
   ../monitor-issues/scripts/github.sh remove-tag "$REPO_PATH" <id> created
   ```

   > Resolve `../monitor-issues/scripts/github.sh` relative to the `auto-rewrite-issue` skill folder.

   If this fails, log the failure — the body was already rewritten on GitHub, but the tag remains, so a future poll will detect `created` again and re-queue the id, triggering a re-rewrite (harmless, just redundant work).

Note on failures: on any failure in this sequence (fetch, rewrite, push, or tag removal), do not re-push the id to the queue from here. `monitor-issues` never recorded this issue's `updated_at` while `created` was pending (it only writes `updated_at` after a successful push to the queue, not after the rewrite completes), so the next `monitor_issues.sh` poll will still see the GitHub `updatedAt` as newer than the stored value, re-detect the `created` tag, and re-push the id on its own.

## Step 3 — Closing report

Once the queue is drained (Step 1 returns exit 1), end with exactly one report printed by the shared script:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-rewrite-issue --status success|failed \
  --summary "<one line>" [--label-change created:] [--next "/discuss-issue <id>"]...
```

> Resolve `../arcanum/_lib/finish_report.sh` relative to the `auto-rewrite-issue` skill folder.

This skill handles many issues per run, while the script keeps only one `--issue` and `--label-change` lines carry no issue id. So never pass `--issue` or `--sub-issue`: the summary names the ids instead. Never pass `--pr` or `--nested` either. There is no `declined` status, because this skill never asks the user anything.

Pick the flags from the outcomes recorded in Step 2:

- **Empty queue** (nothing popped): `--status success`, a summary like `Rewrite queue was empty; nothing to do.`, no `--next`, no `--label-change`.
- **At least one id rewritten**: `--status success`, even if other ids failed. The summary names the rewritten ids and each failed id with its sub-step, e.g. `Rewrote 2 of 3 queued issues (#101, #102); #103 failed at push.` A rewritten id whose tag removal failed is noted too, e.g. `#102 tag removal failed`. Pass one `--next "/discuss-issue <id>"` per rewritten id, in processing order. Failed ids need no action: `monitor-issues` re-detects the `created` tag and re-queues them on its own.
- **Ids popped but none rewritten**: `--status failed`, with a summary naming each id and its failing sub-step. No `--next`.
- Pass `--label-change created:` **once**, and only when at least one tag removal succeeded. It renders `Labels: Created -> (none)`.

Keep the summary to one line, even with many ids: the script trims it but does not wrap it.

Example:

```text
== auto-rewrite-issue: SUCCESS ==
Rewrote 2 of 3 queued issues (#101, #102); #103 failed at push.
Labels: Created -> (none)
Next: /discuss-issue 101
Next: /discuss-issue 102
```

- Per-id failure logs may be printed while draining, but the report's stdout is relayed **verbatim** as the last thing you print. Never hand-format, extend, or paraphrase it.
- If the script itself exits non-zero (usage error), say in one line that the closing report could not be rendered, and end.
