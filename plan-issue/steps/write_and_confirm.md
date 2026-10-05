# Write and Confirm Plan

## Closing report

Every exit of this skill — success below, the declined exit in [Present an overview and ask for confirmation](#abandoning-the-plan-declined), and the failed exits in [file_definition.md](file_definition.md) and below — ends with exactly one report printed by the shared script:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue --status success|declined|failed \
  --summary "<one line>" --issue <id> [--label-change refined:ready]
```

> Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory. `plan-issue` is never run nested by another skill, so `--merge` and `--nested` are never passed.

- Relay its stdout **verbatim** as the last thing you print before any next-step offer. Never hand-format, extend, or paraphrase it.
- Pass only the links and label changes that actually happened (`--label-change refined:ready` only once `mark-ready` has succeeded).
- `declined` and `failed` reports are never followed by a next-step offer.
- If the script itself exits non-zero (usage error), tell the user in one line that the closing report could not be rendered, and end.

### Failed exits

Whenever a step below says "**fail with** `<step>`", stop the skill right there:

1. Release the working tree: `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"` (resolved relative to this file's directory).
2. Keep the plan files in `PLAN_DIR` on disk — do not delete them.
3. Print the `failed` report, with a summary naming the failed step, and only what actually happened before the failure:

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue --status failed --issue <id> \
     --summary "<step> failed for issue #<id>: <short reason>."
   ```

4. End — no next-step offer.

## Discuss the issue with the user

Based solely on the issue description (do **not** look at the code yet), write a draft plan and present it to the user.

Write the plan file(s) in English, regardless of the language used in the issue or by the user.

Model `plan.md` after this structure (adapt sections as needed):

```markdown
# Plan: <Issue Title>

## Overview
<Brief description of what this plan covers>

## Context
<Relevant background from the issue description>

## Implementation Steps

### Step 1 — <Name>
<Description of what to do and why>

### Step 2 — <Name>
<Description of what to do and why>

## Files to Change
- `path/to/file.ext` — <what changes and why>

## Notes
- <Any caveats, risks, open questions, or unknowns>
```

If splitting into multiple files, `plan.md` should serve as the index with links to the other files. This is the same judgment call `auto-plan-issue` makes for a genuinely large plan, and is independent of the step split below.

### Splitting steps into their own files

This mirrors `auto-plan-issue/steps/write_plan.md` exactly, so `plan-issue` and `auto-plan-issue` produce byte-for-byte the same shape for the same input. If the plan involves multiple specialist agents (an `<agent-name>.md` per agent, e.g. via a coordinator's guidance), apply the same rules to each `<agent-name>.md`; otherwise apply them to `plan.md` itself.

**Step file naming**: `<agent-name>/<NN>-<slug>.md` — two-digit zero-padded step number plus a short descriptive slug (e.g. `backend/01-add-users-endpoint.md`). When there is no agent split, use `plan/<NN>-<slug>.md` instead, rooted at `plan.md`.

**Split threshold**: after drafting the steps, count them.

- **1–2 steps**: keep them inline under `## Implementation Steps` in the single file, as in the template above — no subfolder, no separate step files.
- **3 or more steps**: move the steps out into per-step files, and turn the file that held them into an index instead:

```markdown
## Steps

- [01 — Add endpoint](plan/01-add-endpoint.md)
- [02 — Add validation](plan/02-add-validation.md)
- [03 — Wire up UI](plan/03-wire-up-ui.md)
```

(`## Steps` replaces `## Implementation Steps`; `## CI Checks` and `## Notes`, when present, stay in the index, scoped to the whole plan — not duplicated per step.)

Each step file, `plan/<NN>-<slug>.md` (or `<agent-name>/<NN>-<slug>.md` when there is an agent split), is self-contained — no `### Step N` heading, since the filename and index link already convey ordering and name:

```markdown
# <Name>
<Description of what to do and why>

## Files to Change
- `path/to/file.ext` — <what changes and why>
```

`## Files to Change` here is scoped only to that specific step — pull the subset of the overall file list relevant to this step, not the full list.

## Present an overview and ask for confirmation

Present a high-level overview of the plan to the user. Include:

- A summary of what will be implemented
- The main steps or phases
- Any notable design decisions or trade-offs
- Open questions or unknowns that need to be resolved

End with:

```text
Does this approach look correct? Anything to add or correct?
```

Wait for the user's response. During this interaction:

- If the user requests changes or additions, update the plan file(s) accordingly and present the overview again.
- If the user asks a question about the plan:
  - If the answer is already covered in the plan, answer it directly.
  - If the answer is **not yet in the plan and is not known**, say so honestly — do not speculate or invent an answer. Example: *"That's not defined in the plan yet — I don't know."*
  - The user may then either:
    - **Provide the answer or specification directly** — incorporate it into the plan and confirm the update.
    - **Ask the agent to research it** — see "Analyzing the codebase" below.

Repeat until the user confirms the plan is satisfactory. A request for changes is **not** a decline — it keeps this loop going.

### Abandoning the plan (declined)

If, at any point in this loop, the user explicitly abandons planning (e.g. "stop", "cancel", "drop it"):

1. Keep the plan files in `PLAN_DIR` on disk and commit nothing; no label changes.
2. Release the working tree defensively (a no-op here, since nothing was checked out yet):

   ```bash
   ../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
   ```

3. Print the `declined` report (see [Closing report](#closing-report)) and relay it verbatim:

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue --status declined --issue <id> \
     --summary "Planning for issue #<id> abandoned; plan files left uncommitted."
   ```

4. End — no next-step offer.

## Analyzing the codebase

**Do not look at code unless the user explicitly asks or permits it.**

When the user asks you to look at the code (e.g., "check the code", "look at the codebase", "research it", or similar), then:

1. Prefer delegating to the target repo's own agents (set up via `init-claude`) over exploring inline yourself:
   - Run `../scripts/list_agents.sh "$REPO_PATH"` (resolved relative to this file's directory) to list the repo's configured agents; the script takes `repo_path` explicitly as its first argument and resolves `.claude/agents` relative to it. Each line has the form `<name>|<description>`.
   - **No output** — the repo has no `.claude/agents/` set up. Skip to step 2 below and explore inline yourself.
   - **One or more lines** — detect a coordinator agent by description, reusing [`auto-plan-issue/steps/determine_agents.md`](../../auto-plan-issue/steps/determine_agents.md)'s "Exclude the coordinator" heuristic (description mentions things like "coordinator", "coordinates other agents", "spans more than one agent's scope").
     - **Coordinator found** — delegate through it: `Agent(<coordinator-name>, ...)` with the research question; the coordinator decides whether to explore directly or fan out to its own specialists.
     - **No coordinator, but specialist agents exist** — match the issue's topic/paths against each specialist's documented `description` and spawn the matching specialist directly.
     - **No coordinator and no specialist agents remain** — skip to step 2 below and explore inline yourself.

2. If no repo agent handled the investigation (no `.claude/agents/`, or no matching coordinator/specialist), explore the relevant parts of the project folder identified earlier yourself to understand:
   - What code is affected or needs to be created
   - Existing patterns, conventions, and structure
   - Dependencies or constraints
   - Which top-level folders will contain changes — then read `.circleci/config.yml` (if present) to identify which CI jobs apply to those folders and what local commands run them

3. Update the plan with findings (your own, or the dispatched agent's report) and add a `## CI Checks` section if applicable:

   ```markdown
   ## CI Checks
   Before opening a PR, run the following checks for the folders being modified:
   - `<folder>`: `<local command>` (CircleCI job: `<job name>`)
   ```

   `## CI Checks` always belongs on the index file, never on a per-step file, even when the plan is split into per-step files: `plan.md` when there is no agent split (or when it wasn't split into steps at all), or the relevant `<agent-name>.md` when there is an agent split. Never add `## CI Checks` to a `plan/<NN>-<slug>.md` or `<agent-name>/<NN>-<slug>.md` step file.

4. Present the updated overview and ask again:

   ```text
   Does this approach look correct? Anything to add or correct?
   ```

## Commit and publish the plan

Reached once the user confirms the plan — the same way for a freshly written plan and for an existing one (`PLAN_EXISTS=true`). Always use `git -C "$REPO_PATH"`, never a bare `git`, which would operate against the Bash tool's ambient cwd instead of the target repo.

1. **Bootstrap the branch.** Run `../../auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>` — a cross-skill reference to the same reuse-and-merge branch bootstrap script `auto-fix-all` uses (resolved relative to this file's directory). It fetches `origin`, reuses branch `issue-<id>` merged up to date with `origin/main` if it already exists locally or remotely, or creates it fresh from `origin/main` otherwise. If it exits non-zero, **fail with** `checkout_from_main.sh`. Otherwise parse `STATUS` from its output.
   - **`STATUS=conflict`**: apply the same responsible-agent-selection approach as [`auto-resolve-issue/steps/handle_comment.md`](../../auto-resolve-issue/steps/handle_comment.md)'s "Choosing the responsible agent(s)" section, treating each conflicted path it printed like a failed check-run name — dispatch the responsible specialist(s) (or resolve it yourself, if none seem responsible) to fix the conflict, then run `git -C "$REPO_PATH" add` on the resolved paths and `git -C "$REPO_PATH" commit` with no message argument (the merge-commit message `git merge --no-edit` already prepared is reused as-is). No user interaction. If the conflict cannot be resolved, **fail with** `checkout_from_main.sh (merge conflict)`.
   - **`STATUS=ok`**: continue directly.

   The plan files in `PLAN_DIR` (and `ISSUE_FILE`, if it was untracked) were written to the working tree before this checkout and carry over onto `issue-<id>` as untracked files.
2. **Commit the issue file if needed.** Run `git -C "$REPO_PATH" ls-files --error-unmatch <ISSUE_FILE>`. If it exits non-zero (the issue file is not tracked on the branch), run `../../auto-new-issue/scripts/commit_issue.sh "$REPO_PATH" <ISSUE_FILE> <id> "<your AI model name>" "<your AI model noreply email>"` — a cross-skill reference to the same script `auto-new-issue` uses (resolved relative to this file's directory). It commits the issue file and pushes it. If it fails, **fail with** `commit_issue.sh`.
3. **Commit the plan.** Run `git -C "$REPO_PATH" status --porcelain -- <PLAN_DIR>`:
   - **Output is empty** (the plan was already committed, e.g. by an earlier `auto-plan-issue` run): skip the commit and go on to the push.
   - **Otherwise**: run `../../auto-plan-issue/scripts/commit_plan.sh "$REPO_PATH" <PLAN_DIR> <id> "<your AI model name>" "<your AI model noreply email>"` — a cross-skill reference to the same script `auto-plan-issue` uses (resolved relative to this file's directory). It stages `PLAN_DIR`, commits and pushes. Never commit the plan by hand. If it fails, **fail with** `commit_plan.sh`.
4. **Push.** Run `git -C "$REPO_PATH" push`, so any already-committed but unpushed issue or plan commit on `issue-<id>` is published too. If it fails, **fail with** `plan push`.
5. **Swap labels.** Run `../../discuss-issue/scripts/github.sh mark-ready "$REPO_PATH" <id>` (resolved relative to this file's directory) to swap the `Refined` label for `Ready`, now that the issue and plan are committed and pushed. Best-effort: a failure here is not a skill failure — omit `--label-change refined:ready` from the report in that case.
6. **Release the working tree** back to the configured safe branch, handing `issue-<id>` back for other agents sharing the same `.git`:

   ```bash
   ../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
   ```

   > Resolve `../../arcanum/_lib/checkout_safe_branch.sh` relative to this file's directory.

## Success report

Print the `success` report and relay it verbatim (see [Closing report](#closing-report)) — the same summary whether the plan is new or existing:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue --status success --issue <id> \
  --summary "Plan written and committed for issue #<id>." [--label-change refined:ready]
```

Pass `--label-change refined:ready` only if `mark-ready` succeeded.

## Next step: loop auto-resolve-issue

Offer implementation through the shared `/dev/tty` prompt, falling back to a structured `AskUserQuestion` when no TTY is available (TTY-first with `AskUserQuestion` fallback) — never a free-text chat yes/no:

```bash
../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/loop /auto-resolve-issue <id>" --auto-key auto-plan-issue
```

> Resolve `../../arcanum/_lib/next_step_prompt.sh` relative to this file's directory. It prints `CHOICE=yes` / `CHOICE=no` (exit 0) — with `--auto-key` and `next_step.auto.<skill>` set to `true`, `CHOICE=yes` followed by `AUTO=true` (exit 0, no prompt, an `auto-continuing: ...` notice on stderr) — `CHOICE=chat` + `CHAT_CONTEXT=next_step` (exit 3), `FALLBACK=chat` + one `COMMAND=<cmd>` line per `--command`, in order (exit 4, no TTY available), or nothing with an error on stderr (exit 1, prompt failed). The full contract lives in [Next-step offer](../../docs/agents/architecture/skill-finish.md#next-step-offer-interactive-skills).

- **`CHOICE=yes`**: invoke `/loop /auto-resolve-issue <id>` inline, in the same session, through the `loop` skill (`Skill(loop, "/auto-resolve-issue <id>")`), as a **chained** top-level run — no `NESTED=true`. It prints its own report and next step.
- **`CHOICE=yes` with `AUTO=true`** (`next_step.auto.auto-plan-issue` is `true`): relay the `auto-continuing: ...` stderr notice line to the user, then proceed exactly as on `CHOICE=yes` (a chained top-level run, never `NESTED=true`).
- **`CHOICE=no`**: end.
- **`CHOICE=chat`** (exit 3): return to the conversation. Do not run `/loop /auto-resolve-issue <id>` unless the user asks for it in chat.
- **exit 1**: say in one line that the next-step prompt failed: <stderr>, then end.
- **exit 4** (`FALLBACK=chat`, no TTY): ask once with `AskUserQuestion` — the question names the exact command from the `COMMAND=` line(s), with options **Yes** (run it now), **No**, **Chat** — then follow the matching branch above: Yes → `CHOICE=yes`, No → `CHOICE=no`, Chat → `CHOICE=chat`. A free-text "Other" answer → `CHOICE=chat`, with the text as context; a dismissed or rejected question → `CHOICE=no`. If `AskUserQuestion` is unavailable (headless, tool denied), print "Next step: `<cmd>` (run it manually)" for each command and end.

Ask at most once: never re-ask after the user has answered (on the TTY or through `AskUserQuestion`), never ask with a free-text chat yes/no, and never change the command that was shown.
