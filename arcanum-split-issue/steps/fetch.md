# Resolve Issue ID, Fetch Content, and Check for Existing Sub-Issues

The id is always numeric and tied to a real GitHub issue — there is no local-only id convention. `arcanum-split-issue` only operates on existing GitHub issues, so resolving the id and fetching its content is a single script call — the same one `discuss-issue`/`enhance-issue` use, called directly from the canonical `_lib` copy rather than reaching into `discuss-issue/scripts/`:

```bash
../../arcanum/_lib/resolve_and_fetch.sh "$REPO_PATH" docs/agents/issues "<skill_args>"
```

> Resolve `../../arcanum/_lib/resolve_and_fetch.sh` relative to this file's directory (i.e. the `steps/` folder inside this skill) — this skill lives at the same nesting depth as `discuss-issue`/`enhance-issue`, so it calls the promoted `_lib` copy directly instead of the `discuss-issue`-relative wrapper `enhance-issue` uses.

The script guarantees `FILE` exists on disk once it exits `STATUS=ok` — the script handles fetching and writing it; there's nothing left for the agent to do there. The only other case is `STATUS=error` (no id given, or the GitHub issue doesn't exist).

## Interpret the output

### STATUS=ok

`ID`, `TITLE`, and `FILE` are set; `FILE` already has content on disk. Mark the issue as actively being planned for a split:

```bash
../scripts/github.sh mark-planning "$REPO_PATH" <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory. Best-effort — never blocks proceeding. Adds `Planning` and removes whichever of `Idea`/`Writting`/`Created` is present, since this skill can be invoked either before `enhance-issue` (on a bare `Idea`/`Writting` issue) or after it (on a `Created` issue).

Then check whether this issue already has tracked sub-issues:

```bash
../../arcanum/_lib/issue_state.sh get <id> sub-issues
```

- **Empty/absent output** — no sub-issues tracked yet. Proceed straight to [explore.md](explore.md).
- **Non-empty output** (a JSON array with at least one id) — tell the user this issue already has sub-issues tracked (list the ids) and ask whether to:
  - **Skip** — the issue was already split; stop here and report the existing sub-issues, doing nothing else.
  - **Continue** — append more sub-issues to the same parent. Proceed to [explore.md](explore.md); new sub-issue files generated later automatically continue the existing count sequence (`create_sub_issue_file.sh` scans existing files itself, it doesn't trust any count carried over from this check).

### STATUS=error

Tell the user `<ERROR>`, then ask:

```
What is the GitHub issue number to split?
```

Wait for a numeric id, then re-run the resolve-and-fetch script with `"#<id>"` and re-interpret the fresh output from the top of this section.
