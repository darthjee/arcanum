# Resolve Issue ID and Fetch Content

The id is always numeric and tied to a real GitHub issue — there is no local-only id convention. `enhance-issue` only operates on existing GitHub issues, whatever their current tags (`Idea`, `Writting`, or anything else), so resolving the id and fetching its content is a single script call reused directly from `discuss-issue`. Before resolving/fetching anything, this call also fetches and checks out the configured safe branch (default `origin/main`, detached HEAD — see `arcanum/_lib/safe_branch.sh`), parking the working tree off whatever `issue-<id>` branch might already be checked out; a dirty tracked-file working tree makes the whole call fail (a plain script error surfaced to the user, not a `STATUS=error` case):

```bash
../../discuss-issue/scripts/resolve_and_fetch.sh "$REPO_PATH" docs/agents/issues "<skill_args>"
```

> Resolve `../../discuss-issue/scripts/resolve_and_fetch.sh` relative to this file's directory (i.e. the `steps/` folder inside this skill).

If the script exits non-zero with no `STATUS=` line (e.g. the dirty tracked-file working tree above), surface its error to the user, then print the `failed` closing report and end — no label change, no next-step offer, no further checkout (the working tree was never moved):

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill enhance-issue --status failed \
  --summary "resolve_and_fetch.sh failed: <short reason, e.g. dirty working tree>." [--issue <id>]
```

> Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory. Pass `--issue <id>` only if the skill arguments already contained a numeric id. Relay its stdout verbatim as the last thing you print; see [publish.md](publish.md#closing-report) for the report rules.

The script guarantees `FILE` exists on disk once it exits `STATUS=ok` — the script handles fetching and writing it; there's nothing left for the agent to do there. The only other case is `STATUS=error` (no id given, or the GitHub issue doesn't exist).

## Interpret the output

### STATUS=ok

`ID`, `TITLE`, and `FILE` are set; `FILE` already has content on disk. Right after this resolves, mark the issue as actively being enhanced:

```bash
../scripts/github.sh mark-enhancing "$REPO_PATH" <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory — the same wrapper [publish.md](publish.md) already uses for `mark-created`. This runs unconditionally whenever `STATUS=ok` is reached, whether the draft was freshly fetched from GitHub or resumed from an existing local file, and is best-effort — it never blocks proceeding to [explore.md](explore.md).

Derive the **enhancing change** from `mark-enhancing`'s output, and carry it through the rest of the run — it is passed as `--label-change <enhancing change>` to whichever closing report this run ends with (success, declined or failed):

- `idea:enhancing` if it printed `Removed tag 'idea'`;
- `writting:enhancing` if it printed `Removed tag 'writting'`;
- `:enhancing` if it printed `Added tag 'enhancing'` but removed neither;
- **none** if `enhancing` was already present (a resumed run — it printed `Tag 'enhancing' already present`) or the call failed. `mark-enhancing` stays best-effort: a failure here is never a skill failure; just omit the enhancing change from the report.

Proceed straight to [explore.md](explore.md) using `FILE` as the starting material.

### STATUS=error

Tell the user `<ERROR>`, then ask:

```text
What is the GitHub issue number to enhance?
```

Wait for a numeric id, then re-run the resolve-and-fetch script with `"#<id>"` and re-interpret the fresh output from the top of this section.
