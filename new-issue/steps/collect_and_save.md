# Collect Description and Save Issue

## Ask for a description

If the issue content was **pre-populated from GitHub** (Scenario C2 in [extract_id_and_name.md](extract_id_and_name.md)), skip this step and go directly to "Write the issue file" using the fetched body as the description.

Otherwise, say exactly:

```
Describe me the issue
```

Wait for the user's response before continuing.

## Write the issue file

Based on the user's description (or the GitHub body), write a structured issue file. **Always write the file content in English**, regardless of the language the user used to describe the issue. If the description was given in another language, translate it to English before writing.

- **`FILE` is already known** (an id was given or fetched): write to `<issues_folder>/<filename>` as usual.
- **`FILE` is not known yet** (the "create new issue" branch from [extract_id_and_name.md](extract_id_and_name.md)'s `STATUS=missing_id` section — no GitHub issue exists yet for this content): write the drafted content to a temporary file instead (e.g. via `mktemp`), and keep that path at hand for the "Update GitHub issue" step below, which will mint the real issue and the final `FILE`.

Model the structure after this template (adapt sections to what makes sense for the described issue):

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

Use only sections that are relevant. If `DOMAIN` and `REPO` are not already known from a prior `fetch` call, run:

```bash
../scripts/github.sh info
```

> Resolve `../scripts/github.sh` relative to this file's directory.

to obtain them. While the file is still at a temporary path (no GitHub id minted yet), omit the "See issue for details" line entirely — it would be self-referential since the id doesn't exist yet.

If the prior `fetch` call printed a `TAGS_BEGIN`/`TAGS_END` block, append it verbatim at the very end of the written file (after the "See issue for details" line, separated by a blank line), exactly as captured — do not edit, summarize, or reformat it. If no such block was printed, do not add anything; never invent a tags line.

## Confirm and iterate

After writing the file, summarize your understanding of the issue in 2–3 sentences and ask:

```
Did I comprehend the issue?
```

Then loop:

- If the user confirms (yes, sim, correct, looks good, or similar affirmative): finish. The file is already saved.
- If the user says no, gives corrections, or adds details: update the file with the new information, then ask `Did I comprehend the issue?` again.
- If the response is partial or unclear, prompt: `Tell me more`
- Repeat until the user confirms.

## Update GitHub issue

After the user confirms the issue, automatically run one of the following, depending on whether an id was already known:

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

