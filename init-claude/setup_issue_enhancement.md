# Setup Issue Enhancement Concerns

Customize `docs/agents/issue-enhancement.md` — the checklist of "usual concerns" `enhance-issue` uses to help flesh out a vague issue idea before it reaches the `Created` stage.

## Step 1 — Load the current content

By this point, [setup_docs_structure.md](setup_docs_structure.md) has already seeded `docs/agents/issue-enhancement.md` with the default list (if it didn't already exist). Read the file.

## Step 2 — Present the current list and ask for changes

Show the current concern items to the user and ask:

```
Here is the current issue-enhancement checklist. Would you like to add, remove, or reword any items? [y/n]
```

- If the user says no: skip straight to Step 4 — the seeded (or already-customized) content stands as-is.
- If the user says yes: proceed to Step 3.

## Step 3 — Iterate

Let the user describe the change they want (add a new concern, remove one, reword one). Apply it to the in-memory draft, present the updated list, and ask again:

```
Anything else to add, remove, or reword?
```

Repeat until the user says they're done.

## Step 4 — Write the file

Write (or overwrite) `docs/agents/issue-enhancement.md` with the confirmed content, preserving the same structure (a short title, a one-line intro, and a bullet list with one line per concern).

## Step 5 — Confirm

Tell the user:

```
docs/agents/issue-enhancement.md is set. /enhance-issue will use it to check fresh issue ideas against these concerns.
```
