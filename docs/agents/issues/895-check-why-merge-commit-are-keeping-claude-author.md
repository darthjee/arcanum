# Issue: Check why merge commit are keeping claude author

## Description

Squash-merge commits such as `5ece4018318a2c787e92e206031e0e01e78e2845` (PR #893) still carry `Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>` even though `git.omit_model_coauthor` resolves to `true` (repo tier, also set globally — confirmed via `/arcanum-check-config git.omit_model_coauthor` and `arcanum config get git.omit_model_coauthor`).

## Problem

In PR #893 every agent commit respected `git.omit_model_coauthor` except the last one, `chore(docs): remove planning artifacts (issue #892)` (`869f3b9`):

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Co-Authored-By: architect agent <noreply@anthropic.com>
```

That commit is created by `auto-fix-all`'s `cleanup_artifacts.sh` (native `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js#_commit`, shell `auto-fix-all/scripts/cleanup_artifacts_shell.sh`), which builds its message from a hardcoded heredoc instead of the shared attribution logic. Compared with the architect's other commits (`docs(issue): …` via `AutoNewIssueCommitIssue`, `docs(plan): …` via `AutoPlanIssueCommitPlan`):

| | issue/plan commits (architect) | cleanup commit |
|---|---|---|
| Model trailer | omitted when `git.omit_model_coauthor` is `true` | **always emitted** |
| Architect trailer email | resolved via `git.agents.architect` (e.g. `darthjee+architect@gmail.com`) | **the model's email** (`architect agent <noreply@anthropic.com>`) |
| Commit template engine (`.github/commit_message_template-2.0.md`) | respected | ignored |

GitHub's default squash body concatenates every commit's message and appends a deduped `Co-authored-by:` block, so a single leaking commit is enough for the model line to land in the merge commit.

Root-cause enabler: the native commit commands (`AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan`, `AutoFixIssueCommitChange`) each carry a private copy of the trailer logic (`_commitTemplateEngineGet`, `_modelCoauthorOmitted`, the trailer part of `_buildMessage`); only the email lookup is shared (`shared/lib/config/AgentEmail.js`). The cleanup command simply never copied it.

## Expected Behavior

- The planning-artifacts cleanup commit is attributed to the **architect**, exactly like the issue/plan commits: the model's `Co-Authored-By` trailer only when `git.omit_model_coauthor` is not `true`, then `Co-Authored-By: architect agent <architect email>` with the email resolved through the agent-email lookup.
- With `git.omit_model_coauthor` set to `true`, **no** commit produced by arcanum's commit scripts (issue, plan, change, cleanup) carries the model's email in any `Co-Authored-By` trailer — including when the agent email would fall back to the model email.
- As a consequence, squash-merge commits no longer carry the model co-author, whether the PR is merged via the GitHub UI or `pr-merge`.

## Solution

Chosen approach: **extract one shared trailer builder and use it everywhere**. Rejected alternatives: a fourth private copy in `AutoFixAllCleanupArtifacts` (keeps the duplication that caused this bug), or doing that now and refactoring later.

### Native (`core/`, node agent)

- Add a helper under `core/lib/utils/git/` (e.g. `CoauthorTrailers.js`) that, given the repo path, agent name, model name and model email, returns the `Co-Authored-By` trailer lines:
  - the model's line only when `git.omit_model_coauthor` is not `true`;
  - then `<agent> agent <email>`, with the email resolved through `AgentEmail` according to the commit template engine (`new` → agent email lookup, `old` → model email);
  - when `git.omit_model_coauthor` is `true` and the resolved agent email equals the model email, the agent line is dropped too (the commit may end up with no `Co-Authored-By` trailer at all).
- Refactor `AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan` and `AutoFixIssueCommitChange` to use it, dropping their private copies.
- `AutoFixAllCleanupArtifacts` uses it with agent `architect`.

### Shell (scripter agent)

- `auto-fix-all/scripts/cleanup_artifacts_shell.sh` sources `arcanum/_lib/agent_email.sh` (and the commit template engine helper) like `auto-new-issue/scripts/commit_issue_shell.sh` does, instead of its hardcoded heredoc trailers.
- The "drop the agent line when it resolves to the model email under omit" rule is applied consistently in all shell commit scripts (issue, plan, change, cleanup), ideally via a shared function in `arcanum/_lib/agent_email.sh`, so native/shell parity holds.

### Edge cases

1. **Agent email falls back to the model email** (neither `git.agents.<agent>` nor `git.email` set, or old commit template engine) — handled by the drop rule above.
2. **Flag value types** — both the JSON boolean `true` and the string `"true"` count as set (matching the existing commit commands and the shell's `== "true"` check).
3. **Shell config resolution relies on cwd** — `agent_email.sh` reads config via `config_chain_read "."`, so `cleanup_artifacts_shell.sh` must run from inside `$REPO_PATH` (or `cd` there) before using it.
4. **CLI signature unchanged** — `cleanup_artifacts.sh <repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>` keeps its arguments; callers in `auto-resolve-issue/steps/process_one_issue.md` need no change.
5. **Nothing staged** — still a no-op (no commit, no push).

### Backward compatibility

| Config | Today | After | Impact |
|---|---|---|---|
| Default (`omit_model_coauthor` false/unset, no agent email) | cleanup: model line + `architect agent <model email>` | same | none |
| `omit_model_coauthor` false + agent email configured | cleanup: `architect agent <model email>` | `architect agent <architect email>` | bug fix |
| `omit_model_coauthor` true + agent email configured | cleanup leaks the model trailer | model trailer omitted | the intended fix |
| `omit_model_coauthor` true + no agent email (or old commit template engine) | issue/plan/change commits keep `<agent> agent <model email>` | no `Co-Authored-By` trailer at all | only real behavior change |

No opt-out flag; a release-notes line plus docs update covers it. No migration needed — no config shape change, renamed key or moved file.

### Docs (architect)

- `docs/guides/arcanum-repo-config.md` — the `git.omit_model_coauthor` row: add `cleanup_artifacts.sh` to the list of scripts and describe the "also drop the agent trailer when it resolves to the model email" rule.
- `README.md` — the matching `git.omit_model_coauthor` row.

### Testing

- Unit specs for the new helper: omit true/false, string vs boolean flag, agent email configured vs falling back to the model email, old vs new template engine.
- Existing specs for the three refactored commands stay green; add a drop-case spec to each.
- `AutoFixAllCleanupArtifacts` spec and the cleanup-artifacts native/shell parity spec updated for the new trailers (omit true/false, with/without architect email).

### Out of scope

- The merge-body path (`git.merge_body_mode` / `MergeBodyResolver`). Possible follow-up: `MergeBodyResolver#_coauthorsBody` derives its list from commit *authors*, not from `Co-authored-by` trailers as the docs describe.

## Benefits

- `git.omit_model_coauthor` actually keeps the model co-author out of every arcanum-made commit and, transitively, out of merge commits.
- Cleanup commits get correct architect attribution.
- One source of truth for trailer logic, so future commit scripts cannot silently skip it again.
