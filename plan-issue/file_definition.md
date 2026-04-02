# Plan File Definition

## Parse the issue ID

The argument may be in one of these formats:
- `99` → ID is `99`
- `#99` → strip the `#`, ID is `99`

## Locate the issue file

List the files in the issues folder and find the one whose name starts with the given ID (e.g., `99_add_tables.md`). Read that file to understand the issue.

If no matching file is found, inform the user and stop.

## Determine the plan location

The plan folder name follows the same base name as the issue file (without the `.md` extension). For example:
- Issue file: `99_add_tables.md`
- Plan folder: `<plans_folder>/99_add_tables/`
- Main plan file: `<plans_folder>/99_add_tables/plan.md`

If the plan is complex, it may be split into multiple files inside the same folder (e.g., `plan.md`, `plan_api.md`, `plan_database.md`). Use your judgment based on the scope of the issue.

**Check if the plan folder or `plan.md` already exists.** If it does, read the existing plan file(s) and skip directly to the "Present an overview" section in [write_and_confirm.md](write_and_confirm.md).
