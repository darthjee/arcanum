# Dispatch Specialist Agents

Launch one Agent per plan file found in Step 3 of `SKILL.md`, all at the same time (single message, multiple Agent tool calls), so they work in parallel. For each agent:

- `subagent_type`: the agent name itself (e.g. `backend`, `frontend`, `infra`, or whatever name `scripts/list_plan_agents.sh` printed). This agent must already exist as `.claude/agents/<agent-name>.md` in the target project — created by a human or by `/init-claude`. Do not invent or hardcode a fixed set of names; use exactly what the script reported.
- The path to its plan file: `<PLAN_DIR>/<agent-name>.md`.
- The instruction below.

When `scripts/list_plan_agents.sh` printed no output (single unsplit plan, handled directly in Step 3 of `SKILL.md` instead of this step), follow the same development cycle yourself, scoped to the whole `PLAN_FILE`, using your own agent name (`architect`) when calling `scripts/commit_change.sh`.

## Instruction to each specialist agent

> Read your plan file at `<path>`. Implement everything described in it.
>
> Follow the development cycle:
> 1. Implement the changes.
> 2. Run tests and lint/fix (using the commands documented in your own agent instructions, or in the plan's `## CI Checks` section when present).
> 3. Analyze whether refactoring is needed — if so, refactor and repeat from step 2.
> 4. When clean: `git add` your changes, then commit them by running the helper script — never write the commit message or run `git commit` by hand:
>    ```bash
>    scripts/commit_change.sh <type> <scope> <id> "<subject>" <agent> "<AI model name>" "<AI model email>" "<optional body>"
>    ```
>    - `<type>`: `feat`, `fix`, `refactor`, `docs`, `test`, or `chore` — whichever best matches this commit.
>    - `<scope>`: your layer/area (e.g. `backend`, `frontend`, `infra` — match your own agent name unless the plan's `## Files to Change` clearly points to a different scope).
>    - `<id>`: the issue number.
>    - `<agent>`: your own agent name (the same one used as `subagent_type`).
>    - `<AI model name>` and `<AI model email>`: the model you are running on and its canonical noreply email (e.g. `Claude Sonnet 4.6` / `noreply@anthropic.com`).
>    - Resolve `scripts/commit_change.sh` relative to the `auto-fix-issue` skill folder.
>    - You may split your work into multiple atomic commits, each through this script, if the plan has multiple independent steps.
>
> Do not ask for confirmation. Report back with: what you implemented, what files you changed, whether all tests and lint checks passed, and the commit hash(es) you produced.
