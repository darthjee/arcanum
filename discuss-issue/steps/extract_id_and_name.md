# Extract Issue ID and Fetch Content

The id is always numeric and tied to a real GitHub issue — there is no local-only id convention. discuss-issue only operates on existing GitHub issues, so resolving the id and fetching its content is a single script call:

```bash
../scripts/resolve_and_fetch.sh <issues_folder> "<skill_args>"
```

> Resolve `../scripts/resolve_and_fetch.sh` relative to this file's directory (i.e., the `scripts/` folder inside this skill).

The script guarantees `FILE` exists on disk once it exits `STATUS=ok` — the script handles fetching and writing it; there's nothing left for the agent to do there. The only other case is `STATUS=error` (no id given, or the GitHub issue doesn't exist).

## Interpret the output

### STATUS=ok

`ID`, `TITLE`, and `FILE` are set; `FILE` already has content on disk. Proceed straight to [discuss_and_save.md](discuss_and_save.md) using `FILE` as the starting material.

### STATUS=error

Tell the user `<ERROR>`, then ask:

```
What is the GitHub issue number to discuss?
```

Wait for a numeric id, then re-run the resolve-and-fetch script with `"#<id>"` and re-interpret the fresh output from the top of this section.
