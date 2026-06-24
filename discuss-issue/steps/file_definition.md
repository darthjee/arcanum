# Issue File Definition

## Extract ID and title

Read [extract_id_and_name.md](extract_id_and_name.md) and follow the instructions there. The resolve script outputs all three values — `ID`, `TITLE`, and `FILE` — directly.

## Filename format (reference)

The script builds filenames as:

    <id>_<title_in_snake_case>.md

Example: `19_add_database_table.md`.

The id is always numeric and tied to a real GitHub issue — there is no local-only id convention.
