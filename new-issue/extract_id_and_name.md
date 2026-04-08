# Extract Issue ID and Name

Determine the issue ID and title from the skill arguments and the issues folder. Follow the scenario that matches.

---

## Scenario A — Both ID and title provided

**Trigger:** Argument starts with `#` and has a title after it (e.g., `#19 - Add login page` or `#19 Add login page`).

1. Extract the number after `#` as the ID.
2. Skip the separator (` - ` or a space), treat the rest as the title.
3. Replace hyphens used as word separators in the title with spaces.
4. Check if a file with this ID already exists in the issues folder (i.e., a file whose name starts with `<id>_`).
   - **File exists:** Proceed with the existing file — skip the write step in [collect_and_save.md](collect_and_save.md) and go directly to "Confirm and iterate".
   - **File does not exist and ID is numeric:** Run `gh issue view <id> --json title,body` to fetch the initial content from GitHub. Use the returned `body` to pre-populate the issue file instead of asking for a description from scratch. Then proceed to "Confirm and iterate" in [collect_and_save.md](collect_and_save.md).
   - **File does not exist and ID is `X##`:** Proceed normally — ask for a description in [collect_and_save.md](collect_and_save.md).

---

## Scenario B — Title only (no ID provided)

**Trigger:** Argument does not start with `#`, or no argument was given.

1. If no title was given, ask: `What is the title of the issue?` and wait for the response.
2. List existing files in the issues folder.
3. Find the first unused ID in the sequence `X01`, `X02`, `X03`, ... (e.g., if `X01` and `X02` exist, assign `X03`).
4. Proceed with the auto-assigned ID and the provided title.

---

## Scenario C — ID only (no title provided)

**Trigger:** Argument starts with `#` but has no title after it (e.g., `#19`).

Extract the number after `#` as the ID. Then follow the sub-steps below in order:

### C1 — Check the issues folder first

List files in the issues folder and look for any file whose name starts with `<id>_` (e.g., `19_add_login_page.md`).

- **Found:** Extract the title from the filename (convert `snake_case` back to `Title Case`). Proceed with this ID and title — the file already exists, skip the write step in [collect_and_save.md](collect_and_save.md) and go directly to "Confirm and iterate".
- **Not found:** Continue to C2.

### C2 — Fetch from GitHub (numeric IDs only)

If the ID is a plain number (not `X##`), run:

```bash
gh issue view <id> --json title,body
```

- **Success:** Use the returned `title` as the issue title. Use the returned `body` as the initial content for the description — pre-populate the issue file with it instead of asking for a description from scratch. Then proceed to "Confirm and iterate" in [collect_and_save.md](collect_and_save.md).
- **Failure / issue not found:** Inform the user: `Could not find GitHub issue #<id>. Please provide a title.` and ask for a title. Then proceed with the provided title and the numeric ID (no pre-populated content).
