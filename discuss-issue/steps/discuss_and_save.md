# Discuss and Save Issue

This replaces the single "Did I comprehend the issue?" check from `new-issue` with an iterative dialogue loop that may spawn specialist agents before settling on a final issue file.

## 1. Get a starting description

If the issue content was **pre-populated from GitHub** (Scenario C2 in [extract_id_and_name.md](extract_id_and_name.md)), use the fetched body as the starting material and skip straight to "Initial evaluation".

Otherwise, say exactly:

```
Describe me the issue
```

Wait for the user's response before continuing.

## 2. Initial evaluation

Based on whatever is known so far (the user's description or the fetched GitHub body), write a draft issue file using the same template as `new-issue`:

```markdown
# Issue: <Title>

## Description
<Clear explanation of the issue>

## Problem
- <bullet points describing what is broken or missing>

## Expected Behavior
- <what should happen>

## Solution
- <suggested implementation steps, if applicable>

## Benefits
- <why this matters>

---
See issue for details: https://<domain>/<owner>/<repo>/issues/<id>
```

Use only sections that are relevant. **Always write the file content in English**, translating if the user described it in another language.

- **`FILE` is already known**: write to `<issues_folder>/<filename>`.
- **`FILE` is not known yet** (the "create new issue" branch — no GitHub issue exists yet): write the draft to a temporary file instead (e.g. via `mktemp`), and keep that path at hand for the "Update GitHub issue" step below. Omit the "See issue for details" line until a real id is minted.

If `DOMAIN` and `REPO` are not already known from a prior `fetch` call, run:

```bash
../scripts/github.sh info
```

> Resolve `../scripts/github.sh` relative to this file's directory.

If the prior `fetch` call printed a `TAGS_BEGIN`/`TAGS_END` block, remember it — it gets appended verbatim at the very end of the final file (after the "See issue for details" line) once writing is done for good. Do not edit, summarize, or reformat it. If no such block was printed, never invent a tags line.

## 3. Spawn specialist agents as needed

Before drafting clarifying questions, consider whether deeper context would sharpen them. If the issue plausibly touches existing code, behavior, or constraints you cannot judge from the description alone, spawn specialist agents to investigate — for example an `Explore` agent to locate relevant code paths, or a domain-specific agent if the project defines one. This step is optional: skip it when the issue is simple enough that the description is already self-contained.

Use any findings to inform the draft and the questions in the next step.

## 4. Generate clarifying questions

Based on the current draft and any agent findings, generate a short list of clarifying questions that would meaningfully change the issue file — scope boundaries, constraints, edge cases, intent behind ambiguous requests. Do not ask questions the draft already answers.

If there are no meaningful open questions, treat comprehension as already satisfied and skip directly to step 7 (the comprehension check) without presenting questions.

## 5. Present questions and wait

Show the questions to the user and wait for their response.

## 6. Update the draft

Incorporate the user's answers into the issue file (rewriting the temp/real file in place, same rules as step 2).

## 7. Comprehension loop

After updating the draft, summarize your current understanding in 2–3 sentences and ask:

```
Did I comprehend the issue?
```

Then:

- **User confirms** (yes, sim, correct, looks good, or similar affirmative): finish — proceed to "Update GitHub issue" below.
- **User explicitly ends the discussion** (e.g. "done", "stop", "that's enough"): finish as-is — proceed to "Update GitHub issue" below, even if open questions remain.
- **User says no, gives corrections, or adds details**: update the draft with the new information, then go back to step 4 to see if new clarifying questions are warranted before asking "Did I comprehend the issue?" again.
- **Response is partial or unclear**: prompt `Tell me more`, then re-evaluate.

Repeat until one of the two finishing conditions above is met.

## Update GitHub issue

After the loop ends, automatically run one of the following, depending on whether an id was already known:

- **ID already known** (explicit `#<id>` from the user, a number they gave in response to the missing-id question, or a fetched id):
  ```bash
  ../scripts/github.sh update <id> "<Title>" <issue_file_path>
  ```
- **ID was not known** (the "create new issue" branch — the file is still at a temporary path): run
  ```bash
  ../scripts/github.sh create "<Title>" <temp_file_path>
  ```
  instead. Parse the returned `ID`, `FILE`, `DOMAIN`, `REPO` — the script writes the body to the canonical `FILE` itself. Tell the user: `Created GitHub issue #<ID>: <FILE>`. This is the final step; there is nothing left to write or update.

> Resolve `../scripts/github.sh` relative to this file's directory. The script resolves the GitHub domain and repository from `git remote get-url origin`, so no manual `-R` argument is needed. The body is read directly from file via `--body-file`/`cat`, avoiding quoting issues with multi-line content.
