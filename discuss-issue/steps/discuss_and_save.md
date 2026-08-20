# Discuss and Save Issue

This replaces the single "Did I comprehend the issue?" check from `new-issue` with an iterative dialogue loop that may spawn specialist agents before settling on a final issue file.

This skill only handles issues that come **pre-populated from GitHub** — there is no manual "describe the issue to me" flow and no "create a brand-new GitHub issue" flow. It always operates on a real, existing GitHub issue.

## 1. Get the starting content

By the time this step runs, [extract_id_and_name.md](extract_id_and_name.md) has already resolved the id and guaranteed `FILE` exists with content. Read it as the starting material.

## 2. Initial evaluation

Based on the fetched/existing content, draft the section bodies (Description, Problem, Expected Behavior, Solution, Benefits — only the ones that are relevant) and render them to `FILE` by following [issue_template.md](issue_template.md). **Always write the file content in English**, translating if the fetched content was in another language.

## 3. Spawn specialist agents as needed

You (the architect) handle the issue evaluation yourself by default. Before drafting clarifying questions, consider whether deeper context would sharpen them. If the issue plausibly touches existing code, behavior, or constraints you cannot judge from the description alone, spawn specialist agents to investigate. This step is optional: skip it when the issue is simple enough that the description is already self-contained.

When investigation is warranted, prefer delegating to the target repo's own agents (set up via `init-claude`) over a generic one:

1. Run `../scripts/list_agents.sh "$REPO_PATH"` (resolved relative to this file's directory; `$REPO_PATH` is already resolved at the top of [SKILL.md](../SKILL.md)) to list the repo's configured agents; the script takes `repo_path` explicitly as its first argument and resolves `.claude/agents` relative to it. Each line has the form `<name>|<description>`.
2. **No output** — the repo has no `.claude/agents/` set up. Fall back to today's behavior: spawn a generic `Explore` agent to locate relevant code paths.
3. **One or more lines** — detect a coordinator agent by description, reusing [`auto-plan-issue/steps/determine_agents.md`](../../auto-plan-issue/steps/determine_agents.md)'s "Exclude the coordinator" heuristic (description mentions things like "coordinator", "coordinates other agents", "spans more than one agent's scope").
   - **Coordinator found** — always delegate through it: `Agent(<coordinator-name>, ...)` with the exploration question; the coordinator decides whether to explore directly or fan out to its own specialists.
   - **No coordinator, but specialist agents exist** — match the issue's topic/paths against each specialist's documented `description` and spawn the matching specialist directly.
   - **No coordinator and no specialist agents remain** — fall back to a generic `Explore` agent.

Use any findings to inform the draft and the questions in the next step.

## 4. Generate clarifying questions

Based on the current draft and any agent findings, generate a short list of clarifying questions that would meaningfully change the issue file — scope boundaries, constraints, edge cases, intent behind ambiguous requests. Do not ask questions the draft already answers.

Always check one more thing before deciding there are no open questions: does this issue describe introducing a new **top-level (root) folder** in the repo? If so, the draft is not complete until an explicit owning agent is named — extend an existing agent's scope, assign a new specialist, or deliberately record `architect` for genuinely cross-cutting/root-level folders — never left unanswered because no specialist obviously fits. If the draft doesn't already answer this, add "which agent should own `<folder>`?" to the clarifying questions below, phrased to require naming one agent rather than a yes/no.

If there are no meaningful open questions, treat comprehension as already satisfied and skip directly to step 7 (the comprehension check) without presenting questions.

## 5. Present questions and wait

Show the questions to the user and wait for their response.

## 6. Update the draft

Incorporate the user's answers into the issue file (rewriting `FILE` in place, same rules as step 2).

If the dialogue surfaces something that deserves its own GitHub issue instead of folding into `FILE`, spin it off with `../../arcanum/_lib/spawn_issue.sh "$REPO_PATH" <id> "<title>" <body_file>` rather than drafting a file to commit directly. Whether to pass `--as-subissue` is a judgment call each time: pass it when the new issue is genuinely a piece of this issue's own work breakdown, omit it (the default — a comment-only cross-reference) when it's a tangential/independent concern.

## 7. Comprehension confirmation

After updating the draft, summarize your current understanding in 2–3 sentences and ask:

```
Did I comprehend the issue?
```

Wait for the user's free-form reply, then pass it, verbatim, to a script that deterministically resolves it to yes/no — do not judge the reply yourself:

```bash
../scripts/confirm.sh "<raw reply>"
```

> Resolve `../scripts/confirm.sh` relative to this file's directory.

- **Exit 1 (no)**: update the draft with whatever new information the reply contained, then go back to step 4 to see if new clarifying questions are warranted before asking "Did I comprehend the issue?" again.
- **Exit 0 (yes)**: proceed to "Push to GitHub" below, then to step 8.

## Push to GitHub

Run:

```bash
../scripts/github.sh update "$REPO_PATH" <id> "<Title>" <issue_file_path>
../scripts/github.sh mark-refined "$REPO_PATH" <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory. `$REPO_PATH` (resolved once at the top of [SKILL.md](../SKILL.md)) is a required leading argument — the script resolves the GitHub domain and repository from it explicitly, rather than from ambient `git remote get-url origin`. The body is read directly from file via `--body-file`/`cat`, avoiding quoting issues with multi-line content. `mark-refined` adds the `Refined` label and removes `Created`, if present — best-effort, it never blocks this step.

## 8. Planning confirmation

Only reached right after a successful push above. Ask:

```
Would you like me to start planning this issue now?
```

Wait for the user's free-form reply, then pass it to the same script:

```bash
../scripts/confirm.sh "<raw reply>"
```

- **Exit 1 (no)**: finish exactly as today — the issue is already pushed to GitHub; no branch or plan is created. Then release the working tree back to the configured safe branch (defensive no-op — this path never touches `issue-<id>`):
  ```bash
  ../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
  ```
  > Resolve `../../arcanum/_lib/checkout_safe_branch.sh` relative to this file's directory. Nothing further to do.
- **Exit 0 (yes)**:
  1. Run `../../auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>` — a cross-skill reference to the same reuse-and-merge branch bootstrap script `auto-fix-all` uses (resolved relative to this file's directory: `../../auto-fix-all/scripts/checkout_from_main.sh`). It fetches `origin`, reuses branch `issue-<id>` merged up to date with `origin/main` if it already exists locally or remotely, or creates it fresh from `origin/main` otherwise. Parse `STATUS` from its output.
     - **`STATUS=conflict`**: apply the same responsible-agent-selection approach as [`auto-fix-all/steps/handle_comment.md`](../../auto-fix-all/steps/handle_comment.md)'s "Choosing the responsible agent(s)" section, treating each conflicted path it printed like a failed check-run name — dispatch the responsible specialist(s) (or resolve it yourself, as architect, if none seem responsible) to fix the conflict, then run `git -C "$REPO_PATH" add` on the resolved paths and `git -C "$REPO_PATH" commit` with no message argument (the merge-commit message `git merge --no-edit` already prepared is reused as-is) — never bare `git add`/`git commit`, which would operate against the Bash tool's ambient cwd instead of the target repo. No user interaction.
     - **`STATUS=ok`**: continue directly.
  2. Run `../../auto-new-issue/scripts/commit_issue.sh "$REPO_PATH" <issue_file_path> <id> "<your AI model name>" "<your AI model noreply email>"` — a cross-skill reference to the same script `auto-new-issue` uses (resolved relative to this file's directory: `../../auto-new-issue/scripts/commit_issue.sh`). This commits the already-drafted issue file into the branch and pushes it.
  3. As the architect, read [../../auto-plan-issue/steps/run.md](../../auto-plan-issue/steps/run.md) and follow all its steps for `<id>` directly, carrying `REPO_PATH` forward unchanged — do not spawn a separate `Agent(architect)` for this, per this repo's convention for nested skill invocation (see [Agent Roster and Architect Delegation](../../docs/agents/architecture/agent-roster-and-delegation.md)). Its own Step 5 commits the plan locally but does not push.
  4. Run `git -C "$REPO_PATH" push` to push the plan commit too — never a bare `git push`, for the same ambient-cwd reason as above.
  5. Run `../scripts/github.sh mark-ready "$REPO_PATH" <id>` (resolved relative to this file's directory) to swap the `Refined` label for `Ready`, now that the issue + plan are committed and pushed — this is the point where the issue is actually ready for `auto-fix-all`/`auto-fix-issue` to pick up.
  6. Report that the issue and plan are committed and pushed, and stop. Do not continue into `auto-fix-issue` in this run — implementation is a separate, later step.
  7. Release the working tree back to the configured safe branch — this is the one real release among the three skills' closing checkout points: this path is the only one that actually leaves the working tree checked out on `issue-<id>` (via `checkout_from_main.sh` in step 1 above), so this call is what hands the branch back for other agents sharing the same `.git` to pick up:
     ```bash
     ../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
     ```
     > Resolve `../../arcanum/_lib/checkout_safe_branch.sh` relative to this file's directory.
