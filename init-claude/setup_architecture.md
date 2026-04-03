# Setup Architecture Document

Populate `docs/agents/architecture.md` with a description of the project's source layout.

## Step 1 — Identify the main source folder

Scan the project root for directories that are likely to contain the main application source code. Common candidates: `src/`, `source/`, `lib/`, `app/`, `pkg/`, `cmd/`.

If exactly one strong candidate is found, use it.

If the main source folder is ambiguous or cannot be determined, ask the user:

```
Which folder contains the main application source code?
```

Wait for the answer before proceeding.

## Step 2 — Scan the source folder

List the first-level contents of the identified source folder. For each subdirectory, inspect its contents briefly to understand its role.

## Step 3 — Write docs/agents/architecture.md

Overwrite `docs/agents/architecture.md` with a description of the source layout. Use the following structure as a guide, adapting section names to what actually exists:

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

Only include subdirectories that are meaningful to document. Skip generated folders (`node_modules/`, `coverage/`, `tmp/`, `.cache/`, etc.).

If the source folder has a flat structure with no notable subdirectories, describe the key files instead.

## Step 4 — Confirm

Tell the user:

```
docs/agents/architecture.md populated with the source layout of <main_folder>/.
Review and expand it with implementation details as needed.
```
