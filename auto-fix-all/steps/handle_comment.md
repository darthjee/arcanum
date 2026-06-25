# Handle a New PR Comment (or CI Failure)

Unlike Majora's original `fix-all`, this skill never decides the responsible agent from a fixed set of stack keywords (React/Django/Docker/...). Instead it reads the target project's own specialist agent descriptions — the same source `auto-plan-issue` and `auto-fix-issue` already use — and reasons about which one(s) fit.

## List the agents configured in the target project

```bash
../auto-plan-issue/scripts/list_agents.sh
```

(defaults to `.claude/agents`; resolve this path relative to the `auto-plan-issue` skill folder, or copy the script's behavior if that relative path is inconvenient from the current working directory — it simply lists `.claude/agents/*.md` frontmatter `name`/`description` pairs).

Each line has the form `<name>|<description>`.

- **No output (empty)** — the target project has no specialist agents configured. Handle every comment yourself, as architect.
- **One or more lines** — proceed to "Choosing the responsible agent(s)" below for each comment (or failed check-run name, when called from the CI-failure branch of [process_one_issue.md](process_one_issue.md)).

## Question vs. actionable (comments only)

This judgment applies only when handling real PR comments — i.e. the `commented` branch of [process_one_issue.md](process_one_issue.md). It does not apply to failed check-run names, which are always actionable by definition; skip straight to "Choosing the responsible agent(s)" below for those.

For each comment, before doing anything else, read its body and judge whether it is:

- A **question or clarification request** — no code change is implied; the owner is asking something or making an observation. Skip "Choosing the responsible agent(s)" and "Dispatching" below for this comment and go straight to "Replying to a question" instead.
- An **actionable request** — a code change, fix, or feature is being asked for. Proceed exactly as described in "Choosing the responsible agent(s)" below, unchanged.

When a single `commented` batch contains a mix of both, route each comment independently — some replied to directly, others dispatched-and-committed — then return to "Monitor the PR" only once, after every comment in the batch has been handled.

## Choosing the responsible agent(s)

For each comment (or failed check-run name):

1. Read its body carefully (when called from the `commented` branch of [process_one_issue.md](process_one_issue.md), also note its `id`/`url` header lines — keep the `url` at hand for the commit step below).
2. Compare it against each candidate agent's `description` (excluding any agent that is clearly a coordinator/orchestrator rather than an implementation specialist, the same exclusion rule `auto-plan-issue` uses).
3. Judge — based on the content of the comment/failure and what each agent's description says it owns — which agent(s), if any, are responsible for addressing it. There is no fixed keyword table; this is a judgment call grounded in the actual agent descriptions of this project.
4. If **no** agent seems responsible, treat the comment/failure yourself as architect.
5. If **one or more** agents are responsible, proceed to dispatch.

## Dispatching

Launch the responsible agent(s) in parallel (single message, multiple Agent tool calls when there is more than one), each with:

- `subagent_type`: the agent's own name as reported by `list_agents.sh`.
- The full comment body (or failed check-run name plus instruction to inspect the CI logs for it) as the task.
- The relevant plan file path(s) under `docs/agents/plans/<issue_dir>/` for context.
- The instruction to implement the feedback (or fix the failure), run the full local dev/test/lint cycle, and commit via:
  ```bash
  ../../auto-fix-issue/scripts/commit_change.sh <type> <scope> <id> "<subject>" <agent> "<AI model name>" "<AI model email>" "<optional body>" "<comment_url>"
  ```
  (resolved relative to the `auto-fix-issue` skill folder, same script and conventions used during the original implementation step). Pass the comment's `url` (from its header line) as `<comment_url>` when this dispatch is for a specific PR comment; omit it entirely (no trailing argument) when handling a failed check-run, since that isn't tied to any one comment.

If you (architect) are handling a comment/failure yourself, follow the same cycle and commit through the same script with `<agent>` set to `architect`.

## After dispatching

Wait for every dispatched agent (and your own work, if any) to report back, confirming tests/lint passed and the commit hash. Then:

- From the **comment** branch of [process_one_issue.md](process_one_issue.md): return to the top of that file to resume monitoring.
- From the **CI-failure** branch of [process_one_issue.md](process_one_issue.md): return to its `wait_ci.sh` step to re-check.

## Replying to a question

For each comment judged a question/clarification above:

1. Decide which agent should answer, using the same reasoning as "Choosing the responsible agent(s)" — compare the comment against each candidate agent's `description`; fall back to `architect` if none seems responsible.
2. Draft the reply body addressing the question. This is a judgment call, not scripted — the responsible agent (or you, as architect) writes the actual answer.
3. Post it:
   ```bash
   ../scripts/reply_comment.sh <id> <agent> "<your AI model name>" "<your AI model noreply email>" "<reply body>"
   ```
   (resolved relative to the `auto-fix-all` skill folder).
4. No commit, no push, and no CI wait for a question reply — nothing changed in the working tree.

Once every comment in the batch — questions replied to, actionable ones dispatched-and-committed — has been handled, return to "Monitor the PR" (top of [process_one_issue.md](process_one_issue.md)) to resume monitoring.
