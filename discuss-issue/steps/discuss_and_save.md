# Discuss and Save Issue

This replaces the single "Did I comprehend the issue?" check from `new-issue` with an iterative dialogue loop that may spawn specialist agents before settling on a final issue file.

This skill only handles issues that come **pre-populated from GitHub** — there is no manual "describe the issue to me" flow and no "create a brand-new GitHub issue" flow. It always operates on a real, existing GitHub issue.

## 1. Get the starting content

By the time this step runs, [extract_id_and_name.md](extract_id_and_name.md) has already resolved the id and guaranteed `FILE` exists with content. Read it as the starting material.

## 2. Initial evaluation

Based on the fetched/existing content, draft the section bodies (Description, Problem, Expected Behavior, Solution, Benefits — only the ones that are relevant) and render them to `FILE` by following [issue_template.md](issue_template.md). **Always write the file content in English**, translating if the fetched content was in another language.

## 3. Spawn specialist agents as needed

You (the architect) handle the issue evaluation yourself by default. Before drafting clarifying questions, consider whether deeper context would sharpen them. If the issue plausibly touches existing code, behavior, or constraints you cannot judge from the description alone, spawn specialist agents to investigate — for example an `Explore` agent to locate relevant code paths, or a domain-specific agent if the project defines one. This step is optional: skip it when the issue is simple enough that the description is already self-contained.

Use any findings to inform the draft and the questions in the next step.

## 4. Generate clarifying questions

Based on the current draft and any agent findings, generate a short list of clarifying questions that would meaningfully change the issue file — scope boundaries, constraints, edge cases, intent behind ambiguous requests. Do not ask questions the draft already answers.

If there are no meaningful open questions, treat comprehension as already satisfied and skip directly to step 7 (the comprehension check) without presenting questions.

## 5. Present questions and wait

Show the questions to the user and wait for their response.

## 6. Update the draft

Incorporate the user's answers into the issue file (rewriting `FILE` in place, same rules as step 2).

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
../scripts/github.sh update <id> "<Title>" <issue_file_path>
```

> Resolve `../scripts/github.sh` relative to this file's directory. The script resolves the GitHub domain and repository from `git remote get-url origin`, so no manual `-R` argument is needed. The body is read directly from file via `--body-file`/`cat`, avoiding quoting issues with multi-line content.

## 8. Planning confirmation

Only reached right after a successful push above. Ask:

```
Would you like me to start planning this issue now?
```

Wait for the user's free-form reply, then pass it to the same script:

```bash
../scripts/confirm.sh "<raw reply>"
```

- **Exit 1 (no)**: finish exactly as today — the issue is already pushed to GitHub; no branch or plan is created. Nothing further to do.
- **Exit 0 (yes)**:
  1. Run `../../auto-fix-all/scripts/checkout_from_main.sh <id>` — a cross-skill reference to the same reuse-and-merge branch bootstrap script `auto-fix-all` uses (resolved relative to this file's directory: `../../auto-fix-all/scripts/checkout_from_main.sh`). It fetches `origin`, reuses branch `issue-<id>` merged up to date with `origin/main` if it already exists locally or remotely, or creates it fresh from `origin/main` otherwise. Parse `STATUS` from its output.
     - **`STATUS=conflict`**: apply the same responsible-agent-selection approach as [`auto-fix-all/steps/handle_comment.md`](../../auto-fix-all/steps/handle_comment.md)'s "Choosing the responsible agent(s)" section, treating each conflicted path it printed like a failed check-run name — dispatch the responsible specialist(s) (or resolve it yourself, as architect, if none seem responsible) to fix the conflict, then `git add` the resolved paths and run `git commit` with no message argument (the merge-commit message `git merge --no-edit` already prepared is reused as-is). No user interaction.
     - **`STATUS=ok`**: continue directly.
  2. Run `../../auto-new-issue/scripts/commit_issue.sh <issue_file_path> <id> "<your AI model name>" "<your AI model noreply email>"` — a cross-skill reference to the same script `auto-new-issue` uses (resolved relative to this file's directory: `../../auto-new-issue/scripts/commit_issue.sh`). This commits the already-drafted issue file into the branch and pushes it.
  3. As the architect, read [../../auto-plan-issue/steps/run.md](../../auto-plan-issue/steps/run.md) and follow all its steps for `<id>` directly — do not spawn a separate `Agent(architect)` for this, per this repo's convention for nested skill invocation (see [docs/agents/architecture.md](../../docs/agents/architecture.md)'s "Architect Delegation"). Its own Step 5 commits the plan locally but does not push.
  4. Run `git push` to push the plan commit too.
  5. Report that the issue and plan are committed and pushed, and stop. Do not continue into `auto-fix-issue` in this run — implementation is a separate, later step.
