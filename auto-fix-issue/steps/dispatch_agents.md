# Dispatch Specialist Agents

Launch one Agent per plan file found in Step 3 of `SKILL.md`, all at the same time (single message, multiple Agent tool calls), so they work in parallel. For each agent:

- `subagent_type`: the agent name itself (e.g. `backend`, `frontend`, `infra`, or whatever name `scripts/list_plan_agents.sh` printed). This agent must already exist as `.claude/agents/<agent-name>.md` in the target project — created by a human or by `/init-claude`. Do not invent or hardcode a fixed set of names; use exactly what the script reported.
- The path to its plan file: `<PLAN_DIR>/<agent-name>.md`.
- The instruction below, with `<repo_path>` filled in with the literal `REPO_PATH` value — a spawned agent starts with no memory of this conversation and no `$REPO_PATH` shell variable set, so it must be given the actual path as text, not a shell reference.

`scripts/list_plan_agents.sh` printing no output means **no specialist agent owns any of the work** — not merely "the plan wasn't split." A single-owner unsplit plan (`determine_agents.md`'s "exactly one candidate has work" branch) now surfaces as its own `<agent-name>.md` file (see `auto-plan-issue/steps/write_plan.md`'s Case A2) and is dispatched above like any other entry, exactly as if it had been part of a multi-agent split. No output is only possible for genuinely unowned, cross-cutting work — e.g. `docs/agents/**`, root files, or decisions spanning multiple agents — never for work that belongs to a specific specialist.

When that happens (handled directly in Step 3 of `SKILL.md` instead of this step), follow the same development cycle yourself, scoped to the whole `PLAN_FILE`, using your own agent name (`architect`) when calling `scripts/commit_change.sh`, and `"$REPO_PATH"` since you already have it as a real shell variable.

## Instruction to each specialist agent

Before drafting the instruction, determine whether this agent's plan is split into per-step files: run `scripts/list_plan_steps.sh <plan_dir> <agent_name>` (resolved relative to the `auto-fix-issue` skill folder's `scripts/` folder), where `<plan_dir>` is `PLAN_DIR` and `<agent_name>` is this agent's name.

- **No output** — the plan is inline. Use the "Inline plan" instruction below, unchanged from before.
- **One or more lines** — the plan is split. Use the "Split plan" instruction below, which walks the agent through its index file and then each step file in the order `list_plan_steps.sh` printed.

### Inline plan

> The target project's root is `<repo_path>` (substitute the literal `REPO_PATH` value here). Read your plan file at `<path>`. Implement everything described in it.
>
> Follow the development cycle:
> 1. Implement the changes.
> 2. Run your checks:
>    ```bash
>    scripts/run_checks.sh <agent-name>
>    ```
>    (resolved relative to the `auto-fix-issue` skill folder, where `<agent-name>` is your own agent name). This runs `.claude/scripts/check_<agent-name>.sh` if the target project defines one, or reports cleanly that no checks are configured. Use the plan's `## CI Checks` section, when present, as context for investigating any failure it reports. If it exits non-zero, fix the issue and re-run before continuing.
> 3. Analyze whether refactoring is needed — if so, refactor and repeat from step 2.
> 4. When clean: `git add` your changes, then commit them by running the helper script — never write the commit message or run `git commit` by hand:
>    ```bash
>    scripts/commit_change.sh <repo_path> <type> <scope> <id> "<subject>" <agent> "<AI model name>" "<AI model email>" "<optional body>" "<optional comment_url>"
>    ```
>    - `<repo_path>`: the target project's root, already substituted with its literal value in this instruction (see the top of this prompt) — use it verbatim, do not treat it as a shell variable.
>    - `<type>`: `feat`, `fix`, `refactor`, `docs`, `test`, or `chore` — whichever best matches this commit.
>    - `<scope>`: your layer/area (e.g. `backend`, `frontend`, `infra` — match your own agent name unless the plan's `## Files to Change` clearly points to a different scope).
>    - `<id>`: the issue number.
>    - `<agent>`: your own agent name (the same one used as `subagent_type`).
>    - `<AI model name>` and `<AI model email>`: the model you are running on and its canonical noreply email (e.g. `Claude Sonnet 4.6` / `noreply@anthropic.com`).
>    - `<optional comment_url>`: only pass this when the commit addresses a specific PR comment carried over from `auto-fix-all/steps/handle_comment.md` (its `url`); omit it for the initial implementation commits, same as the optional `<body>`.
>    - Resolve `scripts/commit_change.sh` relative to the `auto-fix-issue` skill folder.
>    - You may split your work into multiple atomic commits, each through this script, if the plan has multiple independent steps.
>
> Do not ask for confirmation. Report back with: what you implemented, what files you changed, whether all tests and lint checks passed, and the commit hash(es) you produced.

### Split plan

> The target project's root is `<repo_path>` (substitute the literal `REPO_PATH` value here). Your plan is split into an index file and one file per step.
>
> 1. Read your index file at `<path>` (the same `<agent-name>.md` path as always). Note its `## Shared contracts` (if present), its `## Steps` list, its `## CI Checks`, and its `## Notes` — these apply to your whole plan, not just one step.
> 2. Then, for each step file listed below, in the exact order given — **do not read ahead into a later step's file before finishing the current one**:
>    - Read only that step file.
>    - Implement it.
>    - `git add` your changes for this step, then commit them immediately, before moving to the next step, by running the helper script — never write the commit message or run `git commit` by hand:
>      ```bash
>      scripts/commit_change.sh <repo_path> <type> <scope> <id> "<subject>" <agent> "<AI model name>" "<AI model email>" "<optional body>" "<optional comment_url>"
>      ```
>      (same argument meanings as below; one commit per step, committed inside this loop — this happens before checks are run, not after.)
>
>    Step files, in order:
>    - `<step_file_1>`
>    - `<step_file_2>`
>    - ...
>
> 3. Once every step above is implemented and committed, run checks once for the whole plan:
>    ```bash
>    scripts/run_checks.sh <agent-name>
>    ```
>    (resolved relative to the `auto-fix-issue` skill folder, where `<agent-name>` is your own agent name). This runs `.claude/scripts/check_<agent-name>.sh` if the target project defines one, or reports cleanly that no checks are configured. Use the index file's `## CI Checks` section, when present, as context for investigating any failure it reports.
> 4. If checks fail: fix the issue, then commit the fix(es) as additional commits via `scripts/commit_change.sh` — never amend the per-step commits from step 2. Repeat from step 3 until clean.
> 5. `scripts/commit_change.sh` argument meanings:
>    - `<repo_path>`: the target project's root, already substituted with its literal value in this instruction (see the top of this prompt) — use it verbatim, do not treat it as a shell variable.
>    - `<type>`: `feat`, `fix`, `refactor`, `docs`, `test`, or `chore` — whichever best matches this commit.
>    - `<scope>`: your layer/area (e.g. `backend`, `frontend`, `infra` — match your own agent name unless the step's `## Files to Change` clearly points to a different scope).
>    - `<id>`: the issue number.
>    - `<agent>`: your own agent name (the same one used as `subagent_type`).
>    - `<AI model name>` and `<AI model email>`: the model you are running on and its canonical noreply email (e.g. `Claude Sonnet 4.6` / `noreply@anthropic.com`).
>    - `<optional comment_url>`: only pass this when the commit addresses a specific PR comment carried over from `auto-fix-all/steps/handle_comment.md` (its `url`); omit it otherwise, same as the optional `<body>`.
>    - Resolve `scripts/commit_change.sh` relative to the `auto-fix-issue` skill folder.
>
> Do not ask for confirmation. Report back with: what you implemented (per step), what files you changed, whether all tests and lint checks passed, and the commit hash(es) you produced (one per step, plus any fix-up commits).
