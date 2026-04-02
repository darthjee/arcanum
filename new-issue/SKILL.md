---
name: new-issue
description: Creates a new issue file in the project's issues folder. Parses an optional ID and title, prompts for a description interactively, and saves a structured markdown issue file. Usage: /new-issue #19 - Title or /new-issue Title
---

You are helping the user create a new issue file for the current project. Follow the steps below precisely and in order.

## Step 1 — Find the issues folder

Read `AGENTS.md` (and `CLAUDE.md` if needed) in the current working directory to locate the issues folder. Look for mentions of paths like `docs/issues/`, `docs/agents/issues/`, or similar. Use whatever path is documented there.

## Step 2 — Define the issue ID and filename

Read [file_definition.md](file_definition.md) and follow the instructions there to parse the arguments, auto-assign an ID if needed, and build the filename.

## Step 4 — Ask for a description

Say exactly:

```
Describe me the issue
```

Wait for the user's response before continuing.

## Step 5 — Write the issue file

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

## Step 6 — Ask for confirmation

After writing the file, summarize your understanding of the issue in 2–3 sentences and ask:

```
Did I comprehend the issue?
```

## Step 7 — Iterate or finish

- If the user confirms (yes, sim, correct, looks good, or similar affirmative): finish. The file is already saved.
- If the user says no, gives corrections, or adds details: update the file with the new information, then ask `Did I comprehend the issue?` again.
- If the response is partial or unclear, prompt: `Tell me more`
- Repeat until the user confirms.
