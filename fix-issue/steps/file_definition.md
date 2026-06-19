# Fix Issue File Definition

## Parse the issue ID

The argument may be in one of these formats:
- `5` or `05` → ID is `5`
- `#5` or `#05` → strip the `#`, ID is `5`

Normalize the ID to a plain integer for matching (ignore leading zeros).

The ID must be a plain numeric value tied to a real GitHub issue. If a non-numeric value is given (e.g. a legacy local id like `X01`), stop immediately and report: `Error: issue id must be numeric and linked to a GitHub issue.` Do not attempt to resolve or guess it.

## Locate the issue file

List the files in the issues folder and find the one whose name starts with the given ID (e.g., `05_add_tables.md` or `5_add_tables.md`). Read that file to understand the issue.

If no matching file is found, inform the user:

```
No issue file found for ID <id>. Please create the issue first with /new-issue.
```

Then stop.

## Locate the plan

The plan folder follows the same base name as the issue file (without the `.md` extension). For example:
- Issue file: `05_add_tables.md`
- Plan folder: `<plans_folder>/05_add_tables/`
- Main plan file: `<plans_folder>/05_add_tables/plan.md`

Check if the plan folder or `plan.md` exists. Read the plan file(s).

If no plan is found, inform the user:

```
No plan found for issue <id> — <title>. Please create a plan first with /plan-issue <id>.
```

Then stop.
