# Resolve Issue ID and Fetch Content

The id is always numeric and tied to a real GitHub issue — there is no local-only id convention. `enhance-issue` only operates on existing GitHub issues, whatever their current tags (`Idea`, `Writting`, or anything else), so resolving the id and fetching its content is a single script call reused directly from `discuss-issue`:

```bash
../../discuss-issue/scripts/resolve_and_fetch.sh "$REPO_PATH" docs/agents/issues "<skill_args>"
```

> Resolve `../../discuss-issue/scripts/resolve_and_fetch.sh` relative to this file's directory (i.e. the `steps/` folder inside this skill).

The script guarantees `FILE` exists on disk once it exits `STATUS=ok` — the script handles fetching and writing it; there's nothing left for the agent to do there. The only other case is `STATUS=error` (no id given, or the GitHub issue doesn't exist).

## Interpret the output

### STATUS=ok

`ID`, `TITLE`, and `FILE` are set; `FILE` already has content on disk. Right after this resolves, mark the issue as actively being enhanced:

```bash
../scripts/github.sh mark-enhancing "$REPO_PATH" <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory — the same wrapper [publish.md](publish.md) already uses for `mark-created`. This runs unconditionally whenever `STATUS=ok` is reached, whether the draft was freshly fetched from GitHub or resumed from an existing local file, and is best-effort — it never blocks proceeding to [explore.md](explore.md).

Proceed straight to [explore.md](explore.md) using `FILE` as the starting material.

### STATUS=error

Tell the user `<ERROR>`, then ask:

```
What is the GitHub issue number to enhance?
```

Wait for a numeric id, then re-run the resolve-and-fetch script with `"#<id>"` and re-interpret the fresh output from the top of this section.
