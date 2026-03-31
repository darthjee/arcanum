---
name: new-issue
description: Creates a new issue file in the project's issues folder. Parses an optional ID and title, prompts for a description interactively, and saves a structured markdown issue file. Usage: /new-issue #19 - Title or /new-issue Title
---

You are helping the user create a new issue file for the current project. Follow the steps below precisely and in order.

## Step 1 — Find the issues folder

Read `AGENTS.md` (and `CLAUDE.md` if needed) in the current working directory to locate the issues folder. Look for mentions of paths like `docs/issues/`, `docs/agents/issues/`, or similar. Use whatever path is documented there.

## Step 2 — Parse arguments

The arguments to this skill follow one of these formats:

- **With explicit ID:** `#19 - Title of the issue` → ID is `19`, title is `Title of the issue`
- **Without ID:** `Title-of-the-issue` or `Title of the issue` → auto-assign the next available ID

### Parsing rules

1. If the argument starts with `#`, extract the number after `#` as the ID, skip the separator (` - ` or `-`), and treat the rest as the title.
2. If no `#` is present, the entire argument is the title and the ID must be auto-assigned.
3. Replace hyphens used as word separators in the title with spaces for display.

### Auto-assigning an ID

When no ID is provided, list the existing files in the issues folder and find the first unused ID in the sequence `X01`, `X02`, `X03`, ... (e.g., if `X01` and `X02` are already taken, assign `X03`).

## Step 3 — Determine the filename

Build the filename as:

    <id>_<title_in_snake_case>.md

Where `<title_in_snake_case>` is the title lowercased with spaces replaced by underscores. Example: `19_add_database_table.md`.

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
