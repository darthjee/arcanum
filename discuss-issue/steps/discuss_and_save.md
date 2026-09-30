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

Incorporate the user's answers into the issue file (rewriting `FILE` in place, same rules as step 2). If the user's answer abandons the refinement instead, follow [Abandoning the refinement](#abandoning-the-refinement-declined) below.

If the dialogue surfaces something that deserves its own GitHub issue instead of folding into `FILE`, spin it off with `../../arcanum/_lib/spawn_issue.sh "$REPO_PATH" <id> "<title>" <body_file>` rather than drafting a file to commit directly. Whether to pass `--as-subissue` is a judgment call each time: pass it when the new issue is genuinely a piece of this issue's own work breakdown, omit it (the default — a comment-only cross-reference) when it's a tangential/independent concern.

Remember the `ID=` printed for every issue spawned with `--as-subissue`: each one is passed as `--sub-issue <new id>` to whichever closing report this run ends with (success, declined or failed), since the sub-issue exists regardless of how the run ends.

## 7. Comprehension confirmation

After updating the draft, summarize your current understanding in 2–3 sentences and ask:

```text
Did I comprehend the issue?
```

Wait for the user's free-form reply, then pass it, verbatim, to a script that deterministically resolves it to yes/no — do not judge the reply yourself:

```bash
../scripts/confirm.sh "<raw reply>"
```

> Resolve `../scripts/confirm.sh` relative to this file's directory.

- **Exit 1 (no)**: update the draft with whatever new information the reply contained, then go back to step 4 to see if new clarifying questions are warranted before asking "Did I comprehend the issue?" again. A "no" here is **not** a decline — it only means the draft needs more work.
- **Exit 0 (yes)**: proceed to "Push to GitHub" below, then to step 8.

### Abandoning the refinement (declined)

If, at any point in steps 5–7, the user explicitly abandons the refinement (e.g. "stop", "drop it", "never mind, leave the issue as is"), do not push anything and do not change any label. Release the working tree defensively:

```bash
../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
```

Then print the `declined` report (see [Closing report](#closing-report)) and end — no next-step offer:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill discuss-issue --status declined --issue <id> \
  --summary "Refinement of issue #<id> abandoned by the user; nothing was pushed."
```

## Closing report

Every exit of this skill from here on — and the early exits above — ends with exactly one report printed by the shared script:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill discuss-issue --status success|declined|failed \
  --summary "<one line>" --issue <id> [--sub-issue <id>]... [--label-change <before>:<after>]... [--merge "<block>"]
```

> Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory.

- Relay its stdout **verbatim** as the last thing you print before any next-step offer. Never hand-format, extend, or paraphrase it.
- Pass only the links and label changes that actually happened.
- `declined` and `failed` reports are never followed by a next-step offer.
- If the script itself exits non-zero (usage error), tell the user in one line that the closing report could not be rendered, and end.

### Failed exits

Whenever a step below says "**fail with** `<step>`", stop the skill right there:

1. Release the working tree: `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"` (resolved relative to this file's directory).
2. Print the `failed` report, with a summary naming the failed step, and only what actually happened before the failure (e.g. `--label-change` for the refine swap only if the push already succeeded and `mark-refined` ran):

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill discuss-issue --status failed --issue <id> \
     --summary "<step> failed for issue #<id>: <short reason>." [--label-change <refine change>]
   ```

3. End — no next-step offer.

## Push to GitHub

Run:

```bash
../scripts/github.sh update "$REPO_PATH" <id> "<Title>" <issue_file_path>
```

If `update` exits non-zero, **fail with** `Push to GitHub (update)` — no label change happened. Otherwise run:

```bash
../scripts/github.sh mark-refined "$REPO_PATH" <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory. `$REPO_PATH` (resolved once at the top of [SKILL.md](../SKILL.md)) is a required leading argument — the script resolves the GitHub domain and repository from it explicitly, rather than from ambient `git remote get-url origin`. The body is read directly from file via `--body-file`/`cat`, avoiding quoting issues with multi-line content. `mark-refined` adds the `Refined` label and removes `Created`/`Idea`/`Writting`, if present — best-effort, it never blocks this step and is never a failure.

Derive the **refine change** from `mark-refined`'s output:

- `created:refined` if it printed `Removed tag 'created'`;
- `idea:refined` if it printed `Removed tag 'idea'`;
- `writting:refined` if it printed `Removed tag 'writting'`;
- `:refined` otherwise.

## 8. Next step: planning

Only reached right after a successful push above. Offer planning through the shared `/dev/tty` prompt, falling back to a structured `AskUserQuestion` when no TTY is available (TTY-first with `AskUserQuestion` fallback) — never a free-text chat yes/no:

```bash
../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/auto-plan-issue <id>"
```

> Resolve `../../arcanum/_lib/next_step_prompt.sh` relative to this file's directory. It prints `CHOICE=yes` / `CHOICE=no` (exit 0), `CHOICE=chat` + `CHAT_CONTEXT=next_step` (exit 3), `FALLBACK=chat` + one `COMMAND=<cmd>` line per `--command`, in order (exit 4, no TTY available), or nothing with an error on stderr (exit 1, prompt failed). The full contract lives in [Next-step offer](../../docs/agents/architecture/skill-finish.md#next-step-offer-interactive-skills).

On **exit 4** (`FALLBACK=chat`, no TTY), ask once with `AskUserQuestion` before picking a path below — the question names the exact command from the `COMMAND=` line, with options **Yes** (plan it now), **No**, **Chat** — and treat the answer as the matching choice: Yes → `CHOICE=yes` (plan it), No → `CHOICE=no` (push only), Chat → `CHOICE=chat` (push only). A free-text "Other" answer → `CHOICE=chat`, with the text as context; a dismissed or rejected question → `CHOICE=no`. If `AskUserQuestion` is unavailable (headless, tool denied), take the push-only path and, in step 3, print "Next step: `/auto-plan-issue <id>` (run it manually)" and end.

### `CHOICE=no`, `CHOICE=chat` (exit 3, or mapped from exit 4), or exit 1 — push only

The issue is already pushed; no branch or plan is created.

1. Release the working tree back to the configured safe branch (defensive no-op — this path never touches `issue-<id>`):

   ```bash
   ../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
   ```

2. Print the push-only `success` report and relay it verbatim:

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill discuss-issue --status success --issue <id> \
     --summary "Issue #<id> refined and pushed to GitHub." --label-change <refine change>
   ```

3. Then, depending on the prompt result:
   - **`CHOICE=no`**: end.
   - **exit 1**: say in one line that the next-step prompt failed: <stderr>, then end.
   - **exit 4 with `AskUserQuestion` unavailable**: print "Next step: `/auto-plan-issue <id>` (run it manually)", then end.
   - **`CHOICE=chat`**: return to the conversation. Do not plan unless the user asks for it in chat.

Do not show a second offer on this path.

### `CHOICE=yes` (or mapped from exit 4) — plan it

1. Run `../../auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>` — a cross-skill reference to the same reuse-and-merge branch bootstrap script `auto-fix-all` uses (resolved relative to this file's directory: `../../auto-fix-all/scripts/checkout_from_main.sh`). It fetches `origin`, reuses branch `issue-<id>` merged up to date with `origin/main` if it already exists locally or remotely, or creates it fresh from `origin/main` otherwise. If it exits non-zero, **fail with** `checkout_from_main.sh` (passing the refine change). Otherwise parse `STATUS` from its output.
   - **`STATUS=conflict`**: apply the same responsible-agent-selection approach as [`auto-fix-all/steps/handle_comment.md`](../../auto-fix-all/steps/handle_comment.md)'s "Choosing the responsible agent(s)" section, treating each conflicted path it printed like a failed check-run name — dispatch the responsible specialist(s) (or resolve it yourself, as architect, if none seem responsible) to fix the conflict, then run `git -C "$REPO_PATH" add` on the resolved paths and `git -C "$REPO_PATH" commit` with no message argument (the merge-commit message `git merge --no-edit` already prepared is reused as-is) — never bare `git add`/`git commit`, which would operate against the Bash tool's ambient cwd instead of the target repo. No user interaction. If the conflict cannot be resolved, **fail with** `checkout_from_main.sh (merge conflict)`.
   - **`STATUS=ok`**: continue directly.
2. Run `../../auto-new-issue/scripts/commit_issue.sh "$REPO_PATH" <issue_file_path> <id> "<your AI model name>" "<your AI model noreply email>"` — a cross-skill reference to the same script `auto-new-issue` uses (resolved relative to this file's directory: `../../auto-new-issue/scripts/commit_issue.sh`). This commits the already-drafted issue file into the branch and pushes it. If it fails, **fail with** `commit_issue.sh`.
3. As the architect, read [../../auto-plan-issue/steps/run.md](../../auto-plan-issue/steps/run.md) and follow all its steps for `<id>` directly, carrying `REPO_PATH` forward unchanged, with `NESTED=true` — do not spawn a separate `Agent(architect)` for this, per this repo's convention for nested skill invocation (see [Agent Roster and Architect Delegation](../../docs/agents/architecture/agent-roster-and-delegation.md)). Its own Step 5 commits the plan locally but does not push.
   - If the nested run hands back a `FINISH_*` block, keep it verbatim as `<plan block>` for the merge below. If it hands back none, there is nothing to merge.
   - If the nested run fails — or its block has `FINISH_STATUS=failed` (or `declined`) — **fail with** `auto-plan-issue`, reporting the failure as this skill's own `failed` status. Never merge a failed block into a `success` report.
4. Run `git -C "$REPO_PATH" push` to push the plan commit too — never a bare `git push`, for the same ambient-cwd reason as above. If it fails, **fail with** `plan push`.
5. Run `../scripts/github.sh mark-ready "$REPO_PATH" <id>` (resolved relative to this file's directory) to swap the `Refined` label for `Ready`, now that the issue + plan are committed and pushed — this is the point where the issue is actually ready for `auto-fix-all`/`auto-fix-issue` to pick up. Best-effort: a failure here is not a skill failure (omit the `refined:ready` label change from the report in that case).
6. Release the working tree back to the configured safe branch — this is the one real release among the three skills' closing checkout points: this path is the only one that actually leaves the working tree checked out on `issue-<id>` (via `checkout_from_main.sh` in step 1 above), so this call is what hands the branch back for other agents sharing the same `.git` to pick up:

   ```bash
   ../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
   ```

   > Resolve `../../arcanum/_lib/checkout_safe_branch.sh` relative to this file's directory.

7. Print the merged `success` report and relay it verbatim (`--merge` only if step 3 returned a block):

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill discuss-issue --status success --issue <id> \
     --summary "Issue #<id> refined, planned, and pushed." \
     --label-change <refine change> --label-change refined:ready [--merge "<plan block>"]
   ```

8. Offer implementation:

   ```bash
   ../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/auto-fix-issue <id>"
   ```

   - **`CHOICE=yes`**: invoke `/auto-fix-issue <id>` inline, in the same session, as a **chained** top-level run — no `NESTED=true`. It prints its own report and next step.
   - **`CHOICE=no`**: end.
   - **`CHOICE=chat`** (exit 3): return to the conversation. Do not run `auto-fix-issue` unless the user asks for it in chat.
   - **exit 1**: say in one line that the next-step prompt failed: <stderr>, then end.
   - **exit 4** (`FALLBACK=chat`, no TTY): ask once with `AskUserQuestion` — the question names the exact command from the `COMMAND=` line(s), with options **Yes** (run it now), **No**, **Chat** — then follow the matching branch above: Yes → `CHOICE=yes`, No → `CHOICE=no`, Chat → `CHOICE=chat`. A free-text "Other" answer → `CHOICE=chat`, with the text as context; a dismissed or rejected question → `CHOICE=no`. If `AskUserQuestion` is unavailable (headless, tool denied), print "Next step: `<cmd>` (run it manually)" for each command and end.

   Ask at most once: never re-ask after the user has answered (on the TTY or through `AskUserQuestion`), never ask with a free-text chat yes/no, and never change the command that was shown.
