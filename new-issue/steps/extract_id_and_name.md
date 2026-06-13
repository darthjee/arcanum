# Extract Issue ID and Name

Run the resolve script, passing the issues folder and the raw skill arguments:

```bash
../scripts/resolve_id_and_file.sh <issues_folder> "<skill_args>"
```

> Resolve `../scripts/resolve_id_and_file.sh` relative to this file's directory (i.e., the `scripts/` folder inside this skill).

The script outputs key=value lines. Parse them to obtain `SCENARIO`, `ID`, `TITLE`, `FILE`, `STATUS`, and optionally `NEEDS_FETCH`.

---

## Interpret the output

### STATUS=existing

The file already exists. Skip the write step in [collect_and_save.md](collect_and_save.md) and go directly to "Confirm and iterate".

### STATUS=new (no NEEDS_FETCH)

Proceed normally — ask for a description in [collect_and_save.md](collect_and_save.md). `FILE` is already set.

### STATUS=new + NEEDS_FETCH=true (numeric ID)

Run the fetch script to retrieve the initial content from GitHub:

```bash
../scripts/github.sh fetch <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory.

- **Success:** Use the returned `TITLE`, `FILE`, `DOMAIN`, and `REPO` values. Use the body saved in `FILE` as the initial description. Proceed to "Confirm and iterate" in [collect_and_save.md](collect_and_save.md).
- **Failure / issue not found:** Inform the user: `Could not find GitHub issue #<id>. Please provide a title.`, ask for a title, then proceed with the provided title and the numeric ID (no pre-populated content). The `FILE` from the resolve script can be used once a title is known.

### STATUS=needs_title

No title was provided. Ask: `What is the title of the issue?` and wait for the response. Then re-run the resolve script with the same issues folder and the answer as the arg string, but prefixed with the ID if one was already determined (e.g., `#<ID> <title>`).
