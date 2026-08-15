# Plan: Improve commit template

Issue: [156-improve-commit-template.md](../issues/156-improve-commit-template.md)

## Overview

Give the "agent" `Co-Authored-By` line of every generated commit its own, independently-configurable, per-agent email — while leaving the "model" line and every zero-config repo's output completely untouched. Presence of a new `.github/commit_message_template-2.0.md` file is the switch between the old and new hardcoded message shapes; no template file is ever actually parsed. Three new migrations under `arcanum/migrations/repos/next/` roll this out per-repo, reusing the existing interactive migration runner (`arcanum/migrations/run.sh`) with no new orchestration.

## Context

Today, `auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, and `auto-plan-issue/scripts/commit_plan.sh` each hardcode the commit message shape in bash, emitting two `Co-Authored-By` lines that both reuse the same `MODEL_EMAIL` value. `.github/commit_message_template.md` (and its `init-claude/templates/` source) is purely human-facing documentation — never read at runtime. There is no way to give a specialist agent (or the architect) its own distinct commit-author email, which blocks per-agent GitHub identity/attribution.

Full design detail — the `agent_email_get` fallback-chain snippet, the three-way template-presence resolution rules, the `{agent}`-substitution edge cases (including the `null`/missing-are-the-same-as-absent rule and local-overrides-repo precedence), and the full migration breakdown — is already spelled out in the issue file; this plan turns that into concrete file changes.

## Implementation Steps

### Step 1 — Add the agent-email lookup helper

Create `arcanum/_lib/agent_email.sh` (new file, same pattern as `arcanum/_lib/safe_branch.sh`: sources `repo_config.sh`, no `repo_path` argument — operates on the ambient cwd after `repo_path_enter`). Define:

```bash
# agent_email_get <agent> <model_email>
#   Prints the commit-author email for <agent>: the "git"."email"
#   pattern from .claude/state/arcanum-config.json (local), falling
#   back to .claude/configuration/arcanum-repo-config.json (repo),
#   falling back to <model_email> when neither has a usable value.
#   A JSON `null` value is treated identically to an absent key.
#   The resolved pattern has every "{agent}" occurrence substituted
#   with the literal <agent> name before being printed.
agent_email_get() { ... }
```

Mirror the null/absent handling and quote-stripping shown in the issue's `agent_email_get` snippet exactly.

### Step 2 — Add the template-engine resolution helper

Create `arcanum/_lib/commit_template.sh` (new file, same pattern family). Define:

```bash
# commit_template_engine_get <repo_path>
#   Prints "new" or "old" depending on which commit-message template
#   file is found, in order:
#     1. <repo_path>/.github/commit_message_template-2.0.md -> "new"
#     2. <repo_path>/.github/commit_message_template.md      -> "old"
#     3. neither present -> "new" (arcanum's own installed
#        commit_message_template-2.0.md always exists as the
#        ultimate fallback; its content is documentation only, its
#        mere existence is never actually checked — this branch is
#        reached purely by elimination)
commit_template_engine_get() { ... }
```

No file content is ever read by either helper — both only ever check `[[ -f ... ]]`.

### Step 3 — Wire the helpers into the three commit scripts

Update `auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, and `auto-plan-issue/scripts/commit_plan.sh`:

- Source the two new libs alongside the existing `push.sh`/`repo_config.sh`/`repo_path.sh` sources.
- After `repo_path_enter`, call `commit_template_engine_get "$REPO_PATH"` (or the already-entered cwd, per existing convention) to decide the shape:
  - `"old"` → emit exactly today's two lines (`${AGENT}`/`architect` reusing `MODEL_EMAIL`, unchanged — full backward compat).
  - `"new"` → emit the model line unchanged, then the agent line using `agent_email_get "<agent>" "$MODEL_EMAIL"` in place of `$MODEL_EMAIL`.
- `commit_issue.sh` and `commit_plan.sh` already hardcode `agent="architect"` — pass that literal as `<agent>` to `agent_email_get`, same as `commit_change.sh` passes its `$AGENT` parameter.
- No new required CLI parameters — `MODEL_EMAIL` (or equivalent existing param) is still supplied exactly as today by the calling agent; the only change is what the *agent* line ends up printing.

### Step 4 — Add the new template file content, in both places arcanum ships it

- `init-claude/templates/commit_message_template-2.0.md` (new file) — the source `setup_templates.sh` copies into consumer repos. Content documents the new two-distinct-email shape (mirrors the existing `commit_message_template.md`, with the agent line's placeholder changed to reflect its own configurable email rather than reusing the model's).
- Update `init-claude/scripts/setup_templates.sh`'s `for name in ...` list to also create `commit_message_template-2.0.md` in `.github/` for brand-new repos — a repo running `/init-claude` fresh should start on the new engine immediately, not need the migration.
- Arcanum's own root `.github/commit_message_template-2.0.md` (new file, dogfooding — mirrors the existing root `.github/commit_message_template.md`) — this is the "arcanum installation" copy `commit_template_engine_get`'s rule 3 conceptually falls back to (see Step 2's note: existence isn't actually checked there, but the file should exist for documentation consistency and in case a future revision does check it).

### Step 5 — Scaffold and fill in the three migrations

Use `arcanum/migrations/generate_next.sh --type script` three times (from within `arcanum/migrations/repos/next/`) to scaffold IDs `001`, `002`, `003` in order, then fill in each:

1. **`001` — repo, non-interactive — create `.github/commit_message_template-2.0.md`.** `cmd_run` copies the file from `init-claude/templates/commit_message_template-2.0.md` into `$REPO_PATH/.github/` only if it doesn't already exist (mirrors `setup_templates.sh`'s create-if-absent). Adjust the scaffolded default `"applies_to": "local"` to `"applies_to": "repo"` in `migrations.json`. Keep `"skippable": true`.

2. **`002` — local, interactive — set `git.email` on `.claude/state/arcanum-config.json`.** `cmd_run` follows `0.13.0/001.sh`'s exact `/dev/tty` shape (`[Y]es/[T]ype/[S]kip`, silent-write-guess when no TTY). Guess: derive from `git config user.email` (split at `@`, insert `+{agent}` before it — e.g. `darthjee@gmail.com` → `darthjee+{agent}@gmail.com`); if `git config user.email` is empty, drop the `[Y]es` option and prompt `[T]ype/[S]kip` only. `skippable: true`, `applies_to: "local"` (scaffolded default — no change needed). The `.md` description must explicitly state that `{agent}` is a substitution placeholder, not literal text to type.

3. **`003` — repo, interactive — set `git.email` on `.claude/configuration/arcanum-repo-config.json`.** Same interactive shape as `002`, but `cmd_run` prints an explicit warning before prompting — e.g. "This value will be committed to the repo and visible to all contributors." — and change `"applies_to"` to `"repo"` in `migrations.json`. Same `{agent}`-placeholder explanation in its `.md`.

### Step 6 — Update the dispatch instructions

`auto-fix-issue/steps/dispatch_agents.md`'s `<AI model email>` bullet documents `commit_change.sh`'s call signature to specialist agents. Confirm no call-signature change is needed (Step 3 adds no new required parameter) — if the wording there implies the agent line always mirrors the model line, adjust the surrounding prose so it no longer promises that, since the two can now differ.

## Files to Change

- `arcanum/_lib/agent_email.sh` — new; `agent_email_get` helper (Step 1).
- `arcanum/_lib/commit_template.sh` — new; `commit_template_engine_get` helper (Step 2).
- `auto-fix-issue/scripts/commit_change.sh` — source new libs, branch on engine, use `agent_email_get` for the agent line (Step 3).
- `auto-new-issue/scripts/commit_issue.sh` — same (Step 3).
- `auto-plan-issue/scripts/commit_plan.sh` — same (Step 3).
- `init-claude/templates/commit_message_template-2.0.md` — new; new-shape template content (Step 4).
- `init-claude/scripts/setup_templates.sh` — also create the new template file for fresh installs (Step 4).
- `.github/commit_message_template-2.0.md` — new; arcanum's own dogfooded copy (Step 4).
- `arcanum/migrations/repos/next/migrations.json`, `001.sh`, `001.md`, `002.sh`, `002.md`, `003.sh`, `003.md` — the three new migrations (Step 5).
- `auto-fix-issue/steps/dispatch_agents.md` — prose check/adjustment only, if needed (Step 6).

## Notes

- No CI job in `.circleci/config.yml` runs anything against these folders on regular branches (the only job is tag-triggered release packaging) — verification is manual, per the issue's "Testing strategy" section: exercise `agent_email_get` and `commit_template_engine_get` directly against unset/local-only/repo-only/both/`null`/missing-file states, and run each of the three commit scripts once under the old engine and once under the new engine to confirm output shape.
- Do not build any real template-parsing engine — both new lib functions only ever check file *existence*, never read template file *content* (see the issue's "Template resolution model" section). This is a deliberate scope boundary, not an oversight.
- The model line (`MODEL_EMAIL`) stays fully out of scope for configurability, per the issue — only the agent line's source changes.
- A related, explicitly out-of-scope idea (a global, cross-project local arcanum config) was split off as its own issue, [#160](../issues/160-global-cross-project-local-arcanum-config.md) — no action needed on it from this plan.
