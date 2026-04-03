# Setup Architecture Document

Create or update `docs/agents/architecture.md` with a description of the project's source layout.

## Step 1 — Gather information from all sources

Collect context from the following sources, in order:

1. **Existing file:** If `docs/agents/architecture.md` already exists, read it. Its content is the baseline.
2. **README.md:** If present, read it. It often describes the stack, structure, and design decisions.
3. **Source code:** Scan the project to understand the layout (see Step 2 below).

## Step 2 — Identify the main source folder

Scan the project root for directories likely to contain the main application source code. Common candidates: `src/`, `source/`, `lib/`, `app/`, `pkg/`, `cmd/`.

If exactly one strong candidate is found, use it.

If ambiguous, ask the user:

```
Which folder contains the main application source code?
```

Wait for the answer before proceeding.

Once identified, list the first-level contents of that folder. For each subdirectory, inspect its contents briefly to understand its role.

## Step 3 — Draft the document

Using all gathered information, draft the architecture document. Use this structure as a guide, adapting section names to what actually exists:

```markdown
# Architecture

## Overview

_Brief description of how the application is structured at a high level._

## Source Code Layout

All application source code lives under `<main_folder>/`.

### `<subdirectory>/`

<Description of what lives here and its role.>

### `<subdirectory>/`

<Description of what lives here and its role.>
```

Only document subdirectories that are meaningful. Skip generated folders (`node_modules/`, `coverage/`, `tmp/`, `.cache/`, etc.).

If the source folder has a flat structure, describe the key files instead.

If the existing file already has detailed descriptions, preserve them and only fill in gaps.

## Step 4 — Present draft and ask for confirmation

Show the drafted content to the user and ask:

```
This is the proposed docs/agents/architecture.md. Shall I write it, or would you like to make changes?
```

Wait for the user's response.

- If the user confirms: proceed to write the file.
- If the user requests changes: apply them and ask again before writing.

## Step 5 — Write docs/agents/architecture.md

Write (or overwrite) the file with the confirmed content.

## Step 6 — Confirm

Tell the user:

```
docs/agents/architecture.md written.
Review and expand it with implementation details as needed.
```
