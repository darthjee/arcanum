# Issue: Allow omitting the model's Co-Authored-By line from commit messages via config

## Description
Arcanum's `auto-fix-issue`, `auto-new-issue`, and `auto-plan-issue` scripts each hardcode an unconditional `Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>` trailer on every commit they create, in addition to the agent's own `Co-Authored-By:` line. There is currently no way to disable the model's line — editing `.github/commit_message_template-2.0.md`'s content doesn't help, since only that file's *presence* is checked at runtime (by `arcanum/_lib/commit_template.sh`'s `commit_template_engine_get`, to pick the "new" vs "old" template engine); its content is documentation-only and never parsed.

## Problem
Some maintainers/orgs don't want the AI model attributed as a co-author on every commit and would rather keep only the agent's line, but there's no config toggle for this today. The model's `Co-Authored-By` line is duplicated identically (`echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"`) in three separate scripts — `auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, and `auto-plan-issue/scripts/commit_plan.sh` — so any fix needs to update all three consistently.

## Solution
Extend arcanum's existing 3-tier config chain (`config_chain_read` in `arcanum/_lib/config_chain.sh`: local state `.claude/state/arcanum-config.json` → repo config `.claude/configuration/arcanum-repo-config.json` → global account-wide config — the same chain `git.email` already resolves through via `agent_email_get`) to a new `git` namespace key, e.g. `git.omit_model_coauthor` (final naming left to whoever implements this):

- Add a small helper (mirroring `agent_email_get`'s shape) in `arcanum/_lib/agent_email.sh` or a new sibling lib under `arcanum/_lib/`, reading the key via `config_chain_read`.
- Update `auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, and `auto-plan-issue/scripts/commit_plan.sh` to consult that config and skip emitting the `Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>` line when it's set, while always still emitting the agent's line. Today that line is unconditional — printed before the `commit_template_engine_get() == "new"` check even runs — so the new config applies uniformly regardless of old/new template engine.
- Keep the existing default (both lines emitted) unchanged when the key is absent — purely opt-in, backward compatible.
- Document the new key in `docs/guides/arcanum-repo-config.md` alongside `git.email`/`git.safe_branch`.
- Update the human-facing comments in `.github/commit_message_template-2.0.md` (and any other `commit_message_template*.md`) to mention the new toggle — keeping in mind their content is documentation only, never parsed at runtime.

## Benefits
Gives maintainers/orgs control over commit attribution without having to patch arcanum scripts themselves, consistent with how `git.email`/`git.safe_branch` already let repos override defaults locally or repo-wide.
