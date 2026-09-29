# Push Sub-Issues to GitHub, Report, and Next Step

## Closing report

Every exit of this skill — success here, the declined exits in [fetch.md](fetch.md), [split.md](split.md), and the failed exits in [discuss.md](discuss.md) and below — ends with exactly one report printed by the shared script:

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

> Resolve `../scripts/finish.sh` relative to this file's directory. Relabels the parent issue (`Planning` → `Split`; it stays open as a tracking issue) and deletes the local working files — the parent's own draft and every generated sub-issue file, none of which were ever committed.

Tell the user the split is complete: parent issue `#<id>` is now labeled `Split`, and list each new sub-issue's number and title.

### STATUS=failed

Report clearly, from `CREATED` and `FAILED`:

- Which sub-issues were created successfully (file + new issue number).
- Which sub-issue file failed after exhausting its retry budget.

Tell the user to double-check GitHub directly first — the failure could be a false negative (e.g. the issue was actually created but a later step in that same attempt errored) — before deciding how to proceed. The parent issue stays labeled `Planning` (the finishing step, which would relabel it to `Split`, does not run in this case). Wait for the user's instruction (retry the failed file, skip it, etc.) and act on it by calling the single-file script directly for just that file:

```bash
../scripts/create_sub_issue.sh "$REPO_PATH" <id> <the failed file>
```

Never re-run `push_sub_issues.sh` to recover from a partial failure — that would risk recreating sub-issues that already succeeded. Once every remaining file succeeds, run the finishing step above (`finish.sh`).
