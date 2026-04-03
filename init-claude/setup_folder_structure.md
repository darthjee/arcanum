# Setup Folder Structure Document

Create or update `docs/agents/folder-structure.md` describing the top-level directories of the project.

## Step 1 — Gather information from all sources

Collect context from the following sources, in order:

1. **Existing file:** If `docs/agents/folder-structure.md` already exists, read it. Its content is the baseline.
2. **README.md:** If present, read it. It often describes the project layout.
3. **Project root:** List the contents of the current working directory (first level only). For directories whose purpose is unclear, inspect one level deeper.

## Step 2 — Draft the document

Using all gathered information, draft the folder structure document. Follow these guidelines:

- Focus on the **role** of each directory, not its internal structure
- Go one level deeper only when subdirectories are **meaningfully distinct** and worth documenting (e.g. a `docker_volumes/` folder with named volumes that each serve a specific purpose)
- Skip generated or well-known directories that need no explanation (e.g. `node_modules/`, `.git/`, `coverage/`, `tmp/`)
- If the existing file already has a good description for a directory, preserve it

Use the following structure:

```markdown
# Folder Structure

## Project Root

| Directory / File | Description |
|-----------------|-------------|
| `<name>/`       | <description> |
| `<name>`        | <description for notable root files> |

## <Directory name> (if worth expanding)

| Subdirectory | Description |
|--------------|-------------|
| `<name>/`    | <description> |
```

Only add expanded sections for directories whose subdirectories are meaningfully distinct and not self-explanatory.

## Step 3 — Present draft and ask for confirmation

Show the drafted content to the user and ask:

```
This is the proposed docs/agents/folder-structure.md. Shall I write it, or would you like to make changes?
```

Wait for the user's response.

- If the user confirms: proceed to write the file.
- If the user requests changes: apply them and ask again before writing.

## Step 4 — Write docs/agents/folder-structure.md

Write (or overwrite) the file with the confirmed content.

## Step 5 — Update AGENTS.md documentation table

Add a row for folder structure in the `## Documentation` table inside `AGENTS.md` if not already present:

```
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
```

## Step 6 — Confirm

Tell the user:

```
docs/agents/folder-structure.md written.
AGENTS.md updated.
```
