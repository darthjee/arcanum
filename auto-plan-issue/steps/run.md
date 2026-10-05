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
- If `PLAN_EXISTS=true`, a plan already exists for this issue. Read the existing file(s) in `PLAN_DIR`. This skill never overwrites an existing plan, so write and commit nothing. On a top-level run, first run [Auto-next](#auto-next). Then end with the `success` report (see [Closing report](#closing-report)):

  ```bash
  ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success --issue <id> \
    --summary "Plan for #<id> already exists; nothing was written." --next "/loop /auto-resolve-issue <id>"
  ```

  > With `NESTED=true`, skip [Auto-next](#auto-next), drop `--next` and add `--nested`, then relay the `FINISH_*` block to your caller (see [Nested runs](#nested-runs)).

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

Do not ask for confirmation and do not invoke any fix/PR skill — that orchestration belongs to a separate skill. The one exception is the opt-in chain in [Auto-next](#auto-next), which only hands `/loop /auto-resolve-issue <id>` on when `next_step.auto.auto-plan-issue` is `true`.

On a top-level run, first run [Auto-next](#auto-next). Then print the `success` report and relay it verbatim (see [Closing report](#closing-report)):

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success --issue <id> \
  --summary "Plan for #<id> written and committed in <PLAN_DIR>." --next "/loop /auto-resolve-issue <id>"
```

With `NESTED=true`, skip [Auto-next](#auto-next), drop `--next` and add `--nested` (see [Nested runs](#nested-runs)).

## Auto-next

Used by both success exits (Step 1's "plan already exists" path and Step 6), **only on a top-level run**. A nested run (`NESTED=true`) never calls `auto_next.sh` and never chains: it returns its `FINISH_*` block as usual.

Before printing the success report, run:

```bash
scripts/auto_next.sh "$REPO_PATH" <id>
```

> Resolve `scripts/auto_next.sh` relative to the `auto-plan-issue` skill folder. It decides whether to chain: it checks that HEAD is `issue-<id>`, reads `next_step.auto.auto-plan-issue`, and pushes the plan commit before agreeing to chain. It prints `CHAIN=yes`, or `CHAIN=no` plus `REASON=branch|config|push`, and exits `0`. On a usage error or a failed config read it prints nothing on stdout, an error on stderr, and exits `1`. When it chains, its stderr carries the `auto-continuing: ...` notice.

Then print the success report as usual (`--next "/loop /auto-resolve-issue <id>"`), and:

- **`CHAIN=yes`**: print the `auto-continuing: ...` notice line from its stderr, then the report, then one last line, exactly `AUTO_NEXT=/loop /auto-resolve-issue <id>`. The coordinator in [SKILL.md](../SKILL.md) reads that line and runs the chain (see there). Do not invoke `/loop` or `auto-resolve-issue` yourself.
- **`CHAIN=no` with `REASON=push`**: after the report, add one line saying the plan push failed so the chain was skipped, quoting the git error from its stderr. Then end.
- **`CHAIN=no`** (any other reason): end after the report, as without Auto-next.
- **exit `1`**: after the report, add one line saying the auto-next check failed, quoting its stderr. Then end.

## Closing report

Every exit of this skill ends with exactly one report printed by the shared script:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success|failed \
  --summary "<one line>" [--issue <id>] [--next "/loop /auto-resolve-issue <id>"] [--nested]
```

> Resolve `../arcanum/_lib/finish_report.sh` relative to the `auto-plan-issue` skill folder, the same folder the `scripts/...` calls in these steps resolve against. This skill never asks the user anything, so there is no `declined` status. It changes no labels, so `--label-change` is never passed.

- Relay its stdout **verbatim** as the last thing you print (only the [Auto-next](#auto-next) line or note may follow it). Never hand-format, extend, or paraphrase it.
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
