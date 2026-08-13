# Setup Arcanum Split Issue Concerns

Customize `docs/agents/arcanum-split-issue.md` — the checklist of "usual concerns" `arcanum-split-issue` uses to help discuss how a broad issue should be broken into sub-issues.

## Step 1 — Load the current content

By this point, [setup_docs_structure.md](setup_docs_structure.md) has already seeded `docs/agents/arcanum-split-issue.md` with the default list (if it didn't already exist). Read the file.

## Step 2 — Present the current list and ask for changes

Show the current concern items to the user and ask:

```
Here is the current arcanum-split-issue checklist. Would you like to add, remove, or reword any items? [y/n]
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

Write (or overwrite) `docs/agents/arcanum-split-issue.md` with the confirmed content, preserving the same structure (a short title, a one-line intro, and a bullet list with one line per concern).

## Step 5 — Confirm

Tell the user:

```
docs/agents/arcanum-split-issue.md is set. /arcanum-split-issue will use it to guide how broad issues get broken into sub-issues.
```
