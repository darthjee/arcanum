# Collect Description and Save Issue

## Ask for a description

Say exactly:

```
Describe me the issue
```

Wait for the user's response before continuing.

## Write the issue file

Based on the user's description, write a structured issue file at `<issues_folder>/<filename>`. **Always write the file content in English**, regardless of the language the user used to describe the issue. If the description was given in another language, translate it to English before writing.

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
See issue for details: https://github.com/<owner>/<repo>/issues/<id>
```

Use only sections that are relevant. If the ID is an auto-assigned `X##` placeholder, omit the "See issue for details" line.

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
