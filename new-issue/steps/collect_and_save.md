# Collect Description and Save Issue

## Ask for a description

If the issue content was **pre-populated from GitHub** (Scenario C2 in [extract_id_and_name.md](extract_id_and_name.md)), skip this step and go directly to "Write the issue file" using the fetched body as the description.

Otherwise, say exactly:

```
Describe me the issue
```

Wait for the user's response before continuing.

## Write the issue file

Based on the user's description (or the GitHub body), write a structured issue file at `<issues_folder>/<filename>`. **Always write the file content in English**, regardless of the language the user used to describe the issue. If the description was given in another language, translate it to English before writing.

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

to obtain them. If the ID is an auto-assigned `X##` placeholder, omit the "See issue for details" line entirely.

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

After the user confirms the issue, automatically run:

```bash
../scripts/github.sh update <id> "<Title>" <issue_file_path>
```

> Resolve `../scripts/github.sh` relative to this file's directory.

The script resolves the GitHub domain and repository from `git remote get-url origin`, so no manual `-R` argument is needed. The body is read directly from the saved issue file via `--body-file`, avoiding quoting issues with multi-line content.

> Note: If the ID is an auto-assigned `X##` placeholder, skip this step entirely.

