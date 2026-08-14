# Extract Issue ID and Fetch Content

The id is always numeric and tied to a real GitHub issue — there is no local-only id convention. discuss-issue only operates on existing GitHub issues, so resolving the id and fetching its content is a single script call. Before resolving/fetching anything, this call also fetches and checks out the configured safe branch (default `origin/main`, detached HEAD — see `arcanum/_lib/safe_branch.sh`), parking the working tree off whatever `issue-<id>` branch might already be checked out; a dirty tracked-file working tree makes the whole call fail (a plain script error surfaced to the user, not a `STATUS=error` case):

```bash
../scripts/resolve_and_fetch.sh "$REPO_PATH" <issues_folder> "<skill_args>"
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
