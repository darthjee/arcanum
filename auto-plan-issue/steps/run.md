# Autonomously Produce an Implementation Plan

You are the **architect**. Your job is to autonomously produce a complete implementation plan for an issue — no questions to the user, no confirmation loop. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`. `REPO_PATH` (the target project's root) is carried in from your invocation prompt or from whichever nested caller read this file directly — thread it through to Step 5's `commit_plan.sh` call.

The invocation prompt may also carry `NESTED=true`, set by a nested caller such as `auto-fix-all` or `discuss-issue`. Its absence means this is a top-level run. When present, pass `NESTED=true` on to any run this skill nests in turn (currently none). It changes how every exit ends: see [Closing report](#closing-report) below, which defines the report for every exit path.

## Step 1 — Resolve the issue ID and plan paths

Parse the issue ID from the skill argument (accept `99` or `#99` — strip the `#`).

Run:

```bash
scripts/resolve_plan_paths.sh "$REPO_PATH" docs/agents/issues docs/agents/plans <id>
```

> Resolve `scripts/resolve_plan_paths.sh` relative to the `auto-plan-issue` skill folder.

If no numeric id can be parsed, or the script exits non-zero (e.g. no issue file found for `<id>`), **fail with** `resolve_plan_paths.sh` (see [Failed exits](#failed-exits)) — there is nothing to plan. Pass `--issue <id>` only if a numeric id was parsed; otherwise omit it. With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Otherwise, parse the key=value output to obtain `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, and `PLAN_EXISTS`.

- Read `ISSUE_FILE` to understand the issue.
- If `PLAN_EXISTS=true`, a plan already exists for this issue. Read the existing file(s) in `PLAN_DIR`. This skill never overwrites an existing plan, so write and commit nothing, and end with the `success` report (see [Closing report](#closing-report)):

  ```bash
  ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success --issue <id> \
    --summary "Plan for #<id> already exists; nothing was written." --next "/auto-fix-issue <id>"
  ```

  > With `NESTED=true`, drop `--next` and add `--nested`, then relay the `FINISH_*` block to your caller (see [Nested runs](#nested-runs)).

## Step 2 — Identify the project folder and explore the codebase

Read [explore_codebase.md](explore_codebase.md) and follow the instructions there. Unlike the interactive `plan-issue` skill, you explore the codebase freely and without asking permission.

If exploring the codebase cannot complete, **fail with** `explore codebase`, with `--issue <id>` (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

## Step 3 — Determine agent split

Read [determine_agents.md](determine_agents.md) and follow the instructions there to decide whether the plan is split across specialist agents.

If determining the agent split cannot complete, **fail with** `determine agents`, with `--issue <id>` (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

## Step 4 — Write the plan file(s)

Read [write_plan.md](write_plan.md) and follow the instructions there to write `plan.md` and, if applicable, one file per involved agent inside `PLAN_DIR`.

If writing the plan cannot complete, **fail with** `write plan`, with `--issue <id>` (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

## Step 5 — Commit the plan

Run:

```bash
scripts/commit_plan.sh "$REPO_PATH" <PLAN_DIR> <id> "<your AI model name>" "<your AI model noreply email>"
```

> Resolve `scripts/commit_plan.sh` relative to the `auto-plan-issue` skill folder.

This stages every file under `PLAN_DIR` and commits them using the repo's commit message template, with `type=docs`, `scope=plan`, subject `"add implementation plan"`, and the agent fixed to `architect`. Never commit by hand — always go through this script.

If it exits non-zero, **fail with** `commit_plan.sh`, with `--issue <id>` (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

## Step 6 — Done

Do not ask for confirmation and do not invoke any fix/PR skill — that orchestration belongs to a separate skill. Print the `success` report and relay it verbatim (see [Closing report](#closing-report)):

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success --issue <id> \
  --summary "Plan for #<id> written and committed in <PLAN_DIR>." --next "/auto-fix-issue <id>"
```

With `NESTED=true`, drop `--next` and add `--nested` (see [Nested runs](#nested-runs)).

## Closing report

Every exit of this skill ends with exactly one report printed by the shared script:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success|failed \
  --summary "<one line>" [--issue <id>] [--next "/auto-fix-issue <id>"] [--nested]
```

> Resolve `../arcanum/_lib/finish_report.sh` relative to the `auto-plan-issue` skill folder, the same folder the `scripts/...` calls in these steps resolve against. This skill never asks the user anything, so there is no `declined` status. It changes no labels, so `--label-change` is never passed.

- Relay its stdout **verbatim** as the last thing you print. Never hand-format, extend, or paraphrase it.
- Pass only what actually happened: `--issue <id>` only once an id is known.
- `failed` reports never carry `--next`.
- If the script itself exits non-zero (usage error), say in one line that the closing report could not be rendered, and end.

### Nested runs

When your invocation carried `NESTED=true`, make every `finish_report.sh` call in this file with the same flags **minus `--next`**, **plus `--nested`**. The script then prints a `FINISH_*` result block instead of a report. End by relaying that block verbatim to your caller, with no report and no `Next:` line.

### Failed exits

Whenever a step above says "**fail with** `<step>`", stop the skill right there. Leave any files already written on disk, and do not retry. Print the `failed` report, with a summary naming the failed step:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status failed [--issue <id>] \
  --summary "<step> failed: <short reason>."
```

Pass `--issue <id>` only when the id was parsed when the step failed. Then end, with no `--next`.
