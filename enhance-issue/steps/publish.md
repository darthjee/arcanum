# Publish Back to GitHub

Once the user is satisfied with the issue overall (the end of the [dialogue.md](dialogue.md) loop), push the current state of the local draft to the live GitHub issue, clean up, and end with the standard finish — nothing from this skill is committed to the repo; only the live issue changes.

## Closing report

Every exit of this skill — success here, the declined exit in [dialogue.md](dialogue.md#abandoning-the-enhancement-declined), and the failed exits in [fetch.md](fetch.md) and below — ends with exactly one report printed by the shared script:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill enhance-issue --status success|declined|failed \
  --summary "<one line>" --issue <id> [--sub-issue <id>]... [--label-change <before>:<after>]...
```

> Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory. `enhance-issue` is never run nested by another skill, so `--merge` is never passed.

- Relay its stdout **verbatim** as the last thing you print before any next-step offer. Never hand-format, extend, or paraphrase it.
- Pass only the links and label changes that actually happened:
  - `--label-change <enhancing change>` only if [fetch.md](fetch.md) derived one;
  - `--label-change <created change>` only once `mark-created` has run (success path);
  - `--sub-issue <id>` for every issue spawned with `--as-subissue` during the [dialogue.md](dialogue.md) loop, since the sub-issue exists regardless of how the run ends.
- `declined` and `failed` reports are never followed by a next-step offer.
- If the script itself exits non-zero (usage error), tell the user in one line that the closing report could not be rendered, and end.

### Failed exits

Whenever a step below says "**fail with** `<step>`", stop the skill right there:

1. Release the working tree: `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"` (resolved relative to this file's directory).
2. Keep the local draft `FILE` — do not delete it — so a later `/enhance-issue <id>` resumes from it. The `Enhancing` label stays in place (no revert).
3. Print the `failed` report, with a summary naming the failed step, and only what actually happened before the failure:

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill enhance-issue --status failed --issue <id> \
     --summary "<step> failed for issue #<id>: <short reason>." [--label-change <enhancing change>] [--sub-issue <id>]...
   ```

4. End — no next-step offer.

## 1. Update the issue and swap tags

```bash
../scripts/github.sh update "$REPO_PATH" <id> "<Title>" <issue_file_path>
```

If `update` exits non-zero, **fail with** `Publish (update)` — no further label change happened. Otherwise run:

```bash
../scripts/github.sh mark-created "$REPO_PATH" <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory. `$REPO_PATH` (resolved once at the top of [SKILL.md](../SKILL.md)) is a required leading argument — the script resolves the GitHub domain and repository from it explicitly, rather than from ambient `git remote get-url origin`. `mark-created` adds the `Created` label and removes `Idea`/`Writting`/`Enhancing`, if present — best-effort, it never blocks this step and is never a failure.

Derive the **created change** from `mark-created`'s output:

- `enhancing:created` if it printed `Removed tag 'enhancing'`;
- otherwise `idea:created` if it printed `Removed tag 'idea'`, or `writting:created` if it printed `Removed tag 'writting'` (e.g. `mark-enhancing` had failed earlier);
- otherwise `:created`.

## 2. Delete the local draft

Delete `FILE` (the local `docs/agents/issues/<id>-...md` draft) — unlike `discuss-issue`, this skill never commits its local file; it's transient working material only, and the live GitHub issue body is now the source of truth. This is the only exit path that deletes the draft.

## 3. Release the working tree

```bash
../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"
```

> Resolve `../../arcanum/_lib/checkout_safe_branch.sh` relative to this file's directory. This is a defensive no-op today — this skill never checks out `issue-<id>` itself — but keeps the working tree in the same known-safe state every one of `enhance-issue`/`discuss-issue`/`arcanum-split-issue` leaves it in at its true end point.

## 4. Success report

Print the `success` report and relay it verbatim (see [Closing report](#closing-report)):

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill enhance-issue --status success --issue <id> \
  --summary "Issue #<id> enhanced and pushed to GitHub." \
  [--label-change <enhancing change>] --label-change <created change> [--sub-issue <id>]...
```

## 5. Next step: discuss-issue

Offer the next pipeline step through the shared `/dev/tty` prompt, falling back to a structured `AskUserQuestion` when no TTY is available (TTY-first with `AskUserQuestion` fallback) — never a free-text chat yes/no.

First, check whether the issue is an `Epic`, since an `Epic` never auto-chains:

```bash
../../auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic
```

> Resolve `../../auto-fix-all/scripts/github.sh` relative to this file's directory. Exit `0`: the issue has the `Epic` label. Exit `1`: the labels were fetched and none is `Epic`. Exit `2`: the labels could not be determined. Nothing is printed on stdout.

Then run the offer. Add `--auto-key enhance-issue` **only** if `has-label` exited `1`. On exit `0` (an `Epic`) or `2` (unknown), omit it, so the normal offer is kept:

```bash
../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/discuss-issue <id>" [--auto-key enhance-issue]
```

> Resolve `../../arcanum/_lib/next_step_prompt.sh` relative to this file's directory. It prints `CHOICE=yes` / `CHOICE=no` (exit 0) — with `--auto-key` and `next_step.auto.<skill>` set to `true`, `CHOICE=yes` followed by `AUTO=true` (exit 0, no prompt, an `auto-continuing: ...` notice on stderr) — `CHOICE=chat` + `CHAT_CONTEXT=next_step` (exit 3), `FALLBACK=chat` + one `COMMAND=<cmd>` line per `--command`, in order (exit 4, no TTY available), or nothing with an error on stderr (exit 1, prompt failed). The full contract lives in [Next-step offer](../../docs/agents/architecture/skill-finish.md#next-step-offer-interactive-skills).

- **`CHOICE=yes`**: invoke `/discuss-issue <id>` inline, in the same session, as a **chained** top-level run — no `NESTED=true`. It prints its own report and next step.
- **`CHOICE=yes` with `AUTO=true`**: relay the `auto-continuing: ...` stderr notice line to the user, then proceed exactly as on `CHOICE=yes` (a chained top-level run, never `NESTED=true`).
- **`CHOICE=no`**: end.
- **`CHOICE=chat`** (exit 3): return to the conversation. Do not run `discuss-issue` unless the user asks for it in chat.
- **exit 1**: say in one line that the next-step prompt failed: <stderr>, then end.
- **exit 4** (`FALLBACK=chat`, no TTY): ask once with `AskUserQuestion` — the question names the exact command from the `COMMAND=` line(s), with options **Yes** (run it now), **No**, **Chat** — then follow the matching branch above: Yes → `CHOICE=yes`, No → `CHOICE=no`, Chat → `CHOICE=chat`. A free-text "Other" answer → `CHOICE=chat`, with the text as context; a dismissed or rejected question → `CHOICE=no`. If `AskUserQuestion` is unavailable (headless, tool denied), print "Next step: `<cmd>` (run it manually)" for each command and end.

Ask at most once: never re-ask after the user has answered (on the TTY or through `AskUserQuestion`), never ask with a free-text chat yes/no, and never change the command that was shown.
