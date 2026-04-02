# Issue File Definition

## Parse arguments

The arguments to this skill follow one of these formats:

- **With explicit ID:** `#19 - Title of the issue` → ID is `19`, title is `Title of the issue`
- **Without ID:** `Title-of-the-issue` or `Title of the issue` → auto-assign the next available ID

### Parsing rules

1. If the argument starts with `#`, extract the number after `#` as the ID, skip the separator (` - ` or `-`), and treat the rest as the title.
2. If no `#` is present, the entire argument is the title and the ID must be auto-assigned.
3. Replace hyphens used as word separators in the title with spaces for display.

### Auto-assigning an ID

When no ID is provided, list the existing files in the issues folder and find the first unused ID in the sequence `X01`, `X02`, `X03`, ... (e.g., if `X01` and `X02` are already taken, assign `X03`).

## Determine the filename

Build the filename as:

    <id>_<title_in_snake_case>.md

Where `<title_in_snake_case>` is the title lowercased with spaces replaced by underscores. Example: `19_add_database_table.md`.
