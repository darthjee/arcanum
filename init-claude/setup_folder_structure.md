# Setup Folder Structure Document

Create `docs/agents/folder-structure.md` describing the top-level directories of the project.

## Step 1 — Scan the project root

List the contents of the current working directory (first level only). Identify directories and notable files.

## Step 2 — Describe each directory

For each directory found, write a short description of its purpose. Follow these guidelines:

- Focus on the **role** of the directory, not its internal structure
- Go one level deeper only when the subdirectories are **meaningfully distinct** and worth documenting (e.g. a `docker_volumes/` folder with named volumes that each serve a specific purpose)
- Skip generated or well-known directories that need no explanation (e.g. `node_modules/`, `.git/`, `coverage/`, `tmp/`)
- If the purpose of a directory is not obvious from its name or contents, infer from context or note it as unknown

## Step 3 — Create docs/agents/folder-structure.md

Create the file with the following structure:

```markdown
# Folder Structure

## Project Root

| Directory / File | Description |
|-----------------|-------------|
| `<name>/`       | <description> |
| `<name>/`       | <description> |
| `<name>`        | <description for notable root files> |

## <Directory name> (if worth expanding)

| Subdirectory | Description |
|--------------|-------------|
| `<name>/`    | <description> |
```

Only add expanded sections for directories whose subdirectories are meaningfully distinct and not self-explanatory.

## Step 4 — Update AGENTS.md documentation table

Add a row for folder structure in the `## Documentation` table inside `AGENTS.md`:

```
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
```

## Step 5 — Confirm

Tell the user:

```
docs/agents/folder-structure.md created.
AGENTS.md updated.
```
