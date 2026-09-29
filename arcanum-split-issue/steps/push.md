# Push Sub-Issues to GitHub, Report, and Next Step

## Closing report

Every exit of this skill — success here, the declined exits in [fetch.md](fetch.md) and [split.md](split.md), and the failed exits in [fetch.md](fetch.md), [discuss.md](discuss.md) and below — ends with exactly one report printed by the shared script:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-split-issue --status success|declined|failed \
  --summary "<one line>" --issue <id> [--sub-issue <id>]... [--label-change <before>:<after>]...
```

> Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory. `arcanum-split-issue` is never run nested by another skill, so `--merge` and `--nested` are never passed.

- Relay its stdout **verbatim** as the last thing you print before any next-step offer. Never hand-format, extend, or paraphrase it.
- Pass only the links and label changes that actually happened:
  - `--label-change <planning change>` only if [fetch.md](fetch.md) derived one from `mark-planning`'s output;
  - `--label-change planning:split` only once `finish.sh` has run (success path);
  - `--sub-issue <id>` for every sub-issue actually created on GitHub **in this run** — never ids that were already tracked before it started.
- `declined` and `failed` reports are never followed by a next-step offer.
- If the script itself exits non-zero (usage error), tell the user in one line that the closing report could not be rendered, and end.

### Failed exits

Whenever a step says "**fail with** `<step>`", stop the skill right there:

1. Release the working tree: `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"` (resolved relative to this file's directory).
2. Keep the local parent draft and every generated sub-issue file under `docs/agents/issues/` — do not delete them — so a later `/arcanum-split-issue <id>` resumes from them. The `Planning` label stays in place (no revert).
3. Print the `failed` report, with a summary naming the failed step, and only what actually happened before the failure:

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-split-issue --status failed --issue <id> \
     --summary "<step> failed for issue #<id>: <short reason>." [--label-change <planning change>] [--sub-issue <id>]...
   ```

4. End — no next-step offer.

## Push the sub-issues

On confirmation from [split.md](split.md), push every generated sub-issue file to GitHub:

```bash
../scripts/push_sub_issues.sh "$REPO_PATH" <id>
```

> Resolve `../scripts/push_sub_issues.sh` relative to this file's directory. Iterates every `docs/agents/issues/<id>_*` file in ascending count order, creating each as a real GitHub issue linked to the parent via GitHub's native sub-issue relationship, and tracking each new id in `.claude/state/issue-<id>.json["sub-issues"]`.

## Interpret the output

### STATUS=ok

Every sub-issue was created successfully (`CREATED` lists `<file>:<new_id>` pairs). Run the finishing step:

```bash
../scripts/finish.sh "$REPO_PATH" <id>
```

> Resolve `../scripts/finish.sh` relative to this file's directory. Relabels the parent issue (`Planning` → `Split`; it stays open as a tracking issue), deletes the local working files — the parent's own draft and every generated sub-issue file, none of which were ever committed — and releases the working tree to the safe branch.

Then continue to [Success report](#success-report).

### STATUS=failed

Report clearly, from `CREATED` and `FAILED`:

- Which sub-issues were created successfully (file + new issue number).
- Which sub-issue file failed after exhausting its retry budget.

Tell the user to double-check GitHub directly first — the failure could be a false negative (e.g. the issue was actually created but a later step in that same attempt errored) — before deciding how to proceed. The parent issue stays labeled `Planning` (the finishing step, which would relabel it to `Split`, does not run in this case). Wait for the user's instruction (retry the failed file, skip it, etc.) and act on it by calling the single-file script directly for just that file:

```bash
../scripts/create_sub_issue.sh "$REPO_PATH" <id> <the failed file>
```

> Resolve `../scripts/create_sub_issue.sh` relative to this file's directory. Prints `STATUS=ok` + `ID=<new_id>` (exit 0) on success, or `STATUS=failed` (exit 1). Add every `ID` it returns to the sub-issues created in this run.

Never re-run `push_sub_issues.sh` to recover from a partial failure — that would risk recreating sub-issues that already succeeded.

- **Recovery completes** (every remaining file resolved): run the finishing step above (`finish.sh`), then continue to [Success report](#success-report).
- **The user decides to stop recovering**: **fail with** `Push sub-issues` (see [Failed exits](#failed-exits)) — pass one `--sub-issue` per sub-issue created so far in this run (from `CREATED` plus any recovered via `create_sub_issue.sh`) and `--label-change <planning change>` if [fetch.md](fetch.md) derived one. The parent stays labeled `Planning`, and the remaining local files are kept.

## Success report

Print the `success` report and relay it verbatim (see [Closing report](#closing-report)):

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-split-issue --status success --issue <id> \
  --summary "Issue #<id> split into <N> sub-issues." \
  --sub-issue <new_id>... [--label-change <planning change>] --label-change planning:split
```

> Pass one `--sub-issue` per sub-issue created in this run, in creation order — every `CREATED` pair plus any recovered via `create_sub_issue.sh`. On a **Continue** run (see [fetch.md](fetch.md)), never include sub-issues that were already tracked before this run. `<N>` is the count of those new sub-issues.

## Next step: enhance-issue

Offer the next pipeline step once, through the shared `/dev/tty` prompt — never a chat-mediated yes/no — listing every sub-issue created in this run, in creation order, in a single prompt:

```bash
../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" \
  --command "/enhance-issue <sub-id 1>" --command "/enhance-issue <sub-id 2>" ...
```

> Resolve `../../arcanum/_lib/next_step_prompt.sh` relative to this file's directory. Pass one `--command` per new sub-issue. It prints `CHOICE=yes` / `CHOICE=no` (exit 0), `CHOICE=chat` + `CHAT_CONTEXT=next_step` (exit 3), or nothing (exit 1, prompt unavailable).

- **`CHOICE=yes`**: run each `/enhance-issue <sub-id>` inline, in the same session, in the listed order, each as a **chained** top-level run — no `NESTED=true`. Each prints its own report and its own next-step offer; let that whole chain complete before starting the next sub-issue.
- **`CHOICE=no`**: end.
- **`CHOICE=chat`** (exit 3): return to the conversation. Do not run `enhance-issue` unless the user asks for it in chat.
- **exit 1**: say in one line that the next-step prompt was unavailable, then end.

Never re-ask in chat, and never change the commands that were shown.
