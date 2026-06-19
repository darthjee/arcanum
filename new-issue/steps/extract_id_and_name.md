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

- **Success:** Use the returned `TITLE`, `FILE`, `DOMAIN`, and `REPO` values. Use the body saved in `FILE` as the initial description. If the output also includes a `TAGS_BEGIN`/`TAGS_END` block (the body had a trailing `---`/`tags: ...` section, now stripped from `FILE`), remember it for [collect_and_save.md](collect_and_save.md), which re-appends it verbatim at the end of the final file. Proceed to "Confirm and iterate" in [collect_and_save.md](collect_and_save.md).
- **Failure / issue not found:** Inform the user: `Could not find GitHub issue #<id>. Please provide a title.`, ask for a title, then proceed with the provided title and the numeric ID (no pre-populated content). The `FILE` from the resolve script can be used once a title is known.

### STATUS=missing_id

No numeric GitHub issue ID is known yet (every issue must be backed by a real GitHub issue — there is no local-only id). Tell the user:

```
No GitHub issue ID was provided for this issue. Do you have an existing GitHub issue number, or should I create a new issue on GitHub now?
```

Wait for the response.

- **The user gives a number** (with or without `#`): re-run the resolve script (`../scripts/resolve_id_and_file.sh <issues_folder> "#<id> <title-if-known>"`) and re-interpret the fresh output from the top of this section.
- **The user confirms creating a new issue**: if no title is known yet, ask `What is the title of the issue?` and wait. Then proceed to [collect_and_save.md](collect_and_save.md)'s description-collection flow — note that there is **no `FILE` yet**; the file is only created once `github.sh create` mints the real GitHub issue id (see collect_and_save.md's "create new issue" branch).
