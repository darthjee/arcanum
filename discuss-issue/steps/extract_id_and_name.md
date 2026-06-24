# Extract Issue ID and Fetch Content

discuss-issue only operates on existing GitHub issues, so resolving the id and fetching its content is a single script call:

```bash
../scripts/resolve_and_fetch.sh <issues_folder> "<skill_args>"
```

> Resolve `../scripts/resolve_and_fetch.sh` relative to this file's directory (i.e., the `scripts/` folder inside this skill).

The script outputs key=value lines. Parse them to obtain `STATUS` and, depending on it, `ID`, `TITLE`, `FILE`, `DOMAIN`, `REPO`, and `ERROR`.

## Interpret the output

### STATUS=existing or STATUS=fetched

`FILE` already holds the issue's content (read from disk for `existing`, just written by the fetch for `fetched`). Proceed straight to [discuss_and_save.md](discuss_and_save.md) using `FILE` as the starting material.

If the output includes a `TAGS_BEGIN`/`TAGS_END` block, remember it for [discuss_and_save.md](discuss_and_save.md), which re-appends it verbatim at the end of the final file.

### STATUS=fetch_failed or STATUS=missing_id

Tell the user `<ERROR>`, then ask:

```
What is the GitHub issue number to discuss?
```

Wait for a numeric id, then re-run the resolve-and-fetch script with `"#<id>"` and re-interpret the fresh output from the top of this section.
