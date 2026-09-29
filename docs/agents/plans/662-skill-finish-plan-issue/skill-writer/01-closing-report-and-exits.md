# Closing report, failed and declined exits

## What to change

In `plan-issue/steps/write_and_confirm.md`, add a `## Closing report` section near the top. Mirror `enhance-issue/steps/publish.md`'s section of the same name.

**Closing report rules**
- Every exit of `plan-issue` ends with exactly one report from `../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue --status success|declined|failed --summary "<one line>" --issue <id> [--label-change refined:ready]`. Resolve the path relative to the steps directory.
- Relay the script's stdout verbatim as the last thing printed before any next-step offer. Never hand-format, extend or paraphrase it.
- Pass only the links and label changes that actually happened.
- `plan-issue` is never nested, so never pass `--merge` or `--nested`.
- `declined` and `failed` reports are never followed by a next-step offer.
- If the script exits non-zero, say in one line that the report could not be rendered, then end.

**Failed exits** (add as a subsection)

Whenever a later step says "**fail with** `<step>`", do the following:
1. Release the working tree with `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"`.
2. Keep the plan files on disk.
3. Print a `failed` report. Its summary names the step: `<step> failed for issue #<id>: <short reason>.`
4. End.

**Declined exit** (add in the "Present an overview and ask for confirmation" loop)

If the user explicitly abandons planning (stop, cancel, drop it):
1. Keep the plan files on disk and commit nothing.
2. Release the working tree with `checkout_safe_branch.sh`. This is a defensive no-op here.
3. Print `--status declined --issue <id> --summary "Planning for issue #<id> abandoned; plan files left uncommitted."`.
4. End.

A request for changes is **not** a decline. It keeps the loop going as today.

In `plan-issue/steps/file_definition.md`, replace "If the script fails …, stop and inform the user" with a failed exit:
- print `finish_report.sh ... --status failed --summary "resolve_plan_paths.sh failed for issue #<id>: <reason>."`;
- include `--issue <id>` only when `<id>` was numeric;
- nothing was checked out yet, so the safe-branch release is a harmless no-op and may be included for uniformity.

## Files to Change
- `plan-issue/steps/write_and_confirm.md`: add the Closing report and Failed exits sections, plus the declined exit inside the confirmation loop.
- `plan-issue/steps/file_definition.md`: add the failed exit when the resolver fails.
