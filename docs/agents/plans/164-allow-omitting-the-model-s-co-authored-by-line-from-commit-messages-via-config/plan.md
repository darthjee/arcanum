# Plan: Allow omitting the model's Co-Authored-By line from commit messages via config

Issue: [164-allow-omitting-the-model-s-co-authored-by-line-from-commit-messages-via-config.md](../../issues/164-allow-omitting-the-model-s-co-authored-by-line-from-commit-messages-via-config.md)

## Overview

Add a new `git.omit_model_coauthor` boolean config key, resolved through arcanum's existing 3-tier config chain (`config_chain_read` in `arcanum/_lib/config_chain.sh`: local state → repo config → global account-wide — the same chain `git.email` already uses via `agent_email_get`). When set to `true`, the three commit scripts (`auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, `auto-plan-issue/scripts/commit_plan.sh`) skip emitting the model's `Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>` trailer, while always still emitting the agent's line. Default (key absent) keeps today's behavior unchanged — purely opt-in.

## Context

Today, `commit_change.sh`, `commit_issue.sh`, and `commit_plan.sh` each hardcode an unconditional `echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"` — printed *before* the `commit_template_engine_get() == "new"` check even runs, so it fires identically regardless of old/new template engine. There is no way to disable it. Editing `.github/commit_message_template-2.0.md`'s content doesn't help — only that file's presence is checked at runtime (`commit_template_engine_get` in `arcanum/_lib/commit_template.sh`); its content is human-facing documentation only.

Arcanum already has a config precedence pattern for exactly this kind of per-repo/global toggle: `git.email` (agent's own line) and `git.safe_branch` are both read via helpers in `arcanum/_lib/`, with `git.email` specifically going through the full 3-tier `config_chain_read` (local → repo → global) defined in `arcanum/_lib/config_chain.sh`. This plan extends that same chain to a new `git.omit_model_coauthor` key, discussed and confirmed with the user in the issue's refinement (full 3-tier, matching `git.email`, not the local-only shape `git.safe_branch` uses).

## Implementation Steps

### Step 1 — Add the config helper

In `arcanum/_lib/agent_email.sh` (already sourced by all three commit scripts, and already sources `config_chain.sh`), add a sibling function to `agent_email_get`:

```bash
# model_coauthor_omitted
#   Prints "true" if the "git"."omit_model_coauthor" key (resolved via
#   config_chain_read: local state -> repo config -> global) is truthy,
#   "false" otherwise (including when absent/null/any other value) —
#   default false, purely opt-in.
model_coauthor_omitted() {
  local value
  value=$(config_chain_read "." "git" "omit_model_coauthor")
  [[ "$value" == "true" ]] && { echo "true"; return; }
  echo "false"
}
```

No new `source` line needed in the three commit scripts — they already `source .../agent_email.sh`.

### Step 2 — Wire the toggle into the three commit scripts

In `auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, and `auto-plan-issue/scripts/commit_plan.sh`, change the commit-message heredoc block from:

```bash
echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"
echo "Co-Authored-By: ${AGENT} agent <${AGENT_EMAIL}>"
```

to:

```bash
if [[ "$(model_coauthor_omitted)" != "true" ]]; then
  echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"
fi
echo "Co-Authored-By: ${AGENT} agent <${AGENT_EMAIL}>"
```

(`commit_issue.sh`/`commit_plan.sh` use a fixed `AGENT="architect"` inline rather than a variable — apply the same conditional around their literal model line, agent line unchanged.) The agent's line is always emitted, in every case, regardless of this config.

### Step 3 — Document the new key

In `docs/guides/arcanum-repo-config.md`, add `git.omit_model_coauthor` to the documented keys alongside `git.email`/`git.safe_branch`, noting: boolean, default `false`, resolved through the full 3-tier chain (local → repo → global — see `arcanum-global-config.md`), and that setting it `true` drops the model's `Co-Authored-By` line from commits made by `auto-fix-issue`/`auto-new-issue`/`auto-plan-issue`, keeping only the agent's line.

### Step 4 — Update human-facing template docs

Update the "Note:" section in `.github/commit_message_template-2.0.md` **and** `init-claude/templates/commit_message_template-2.0.md` (currently identical — keep them in sync) to mention `git.omit_model_coauthor` alongside the existing `git.email` explanation: setting it `true` (same three config locations: local state, repo config, or global) omits the model's `Co-Authored-By` line entirely, leaving only the agent's. Keep in mind this file's content is purely documentation, never parsed at runtime — only its presence/absence selects the "new" vs "old" template engine.

## Files to Change

- `arcanum/_lib/agent_email.sh` — add `model_coauthor_omitted()` helper
- `auto-fix-issue/scripts/commit_change.sh` — conditionally skip the model's `Co-Authored-By` line
- `auto-new-issue/scripts/commit_issue.sh` — same
- `auto-plan-issue/scripts/commit_plan.sh` — same
- `docs/guides/arcanum-repo-config.md` — document `git.omit_model_coauthor`
- `.github/commit_message_template-2.0.md` — mention the new toggle in the human-facing Note
- `init-claude/templates/commit_message_template-2.0.md` — same update, kept identical to the `.github/` copy

## Notes

- No CI workflow exists in this repo (`.github/workflows/` is empty) — no `## CI Checks` section applies. The closest existing verification pattern is a standalone `bash <script>` regression check (see `arcanum/_lib/test_origin_resolution.sh`); manually sourcing `agent_email.sh` and exercising `model_coauthor_omitted()` against a temp config file is the equivalent smoke check here, but adding a new formal test file isn't required by the issue.
- The old template engine path (`.github/commit_message_template.md` present, no `-2.0.md`) also currently emits the unconditional model line — the fix in Step 2 applies uniformly to both engines since the conditional sits above the `commit_template_engine_get` branch, so no old-template-specific doc update is needed beyond Step 4's new-template Note (the old template file has no equivalent explanatory section today).
- Key naming (`git.omit_model_coauthor`) and helper placement (`agent_email.sh` vs. a new sibling lib) were left open by the issue; this plan picks `agent_email.sh` since it's already sourced by all three callers and already pulls in `config_chain.sh`, avoiding a new source line in three files.
