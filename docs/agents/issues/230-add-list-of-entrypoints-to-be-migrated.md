# Issue: Add list of entrypoints to be migrated

## Problem
`arcanum/_lib/migration-status.json` currently lists only the entrypoints that have already been migrated to native (value `true`). It has no entries for entrypoints still on the shell implementation (`false`), so `docs/agents/architecture/entrypoint-migration-status.md` — generated from this JSON by `scripts/generate_entrypoint_migration_status.sh` — only shows the 4 already-migrated rows instead of the full migration picture. This applies to both `arcanum/_lib/*.sh` entrypoints and every skill's own `<skill>/scripts/*.sh` entrypoints — both are in scope per `docs/agents/architecture/script-engine.md`.

## Expected Behavior
`migration-status.json` lists every in-scope entrypoint — `arcanum/_lib/*.sh` and every skill's `scripts/*.sh` — with `true`/`false` accurately reflecting its migration status. Regenerating the table via `scripts/generate_entrypoint_migration_status.sh` then shows the complete set of entrypoints across the whole repo, migrated and pending, not just the migrated ones.

## Solution

### 1. Naming convention
Keys stay kebab-case, derived from the script's basename (`_` → `-`, no `.sh`). Several skills have independent scripts sharing a basename (e.g. `config.sh`, `github.sh` exist as separate, non-identical implementations in more than one skill), so skill-level keys are qualified with their skill name: `<skill-name>-<script-basename>` (e.g. `auto-fix-all-github`, `monitor-issues-github`). `arcanum/_lib/*.sh` keeps its existing unqualified convention (`resolve-and-fetch`, etc.) since those names are already unique and already have a precedent.

### 2. `arcanum/_lib/*.sh` — add 7 entries with `false`
Verified as real entrypoints (called directly, not sourced) and not yet in the JSON:

| Key | Script |
| --- | --- |
| `github-issue` | `github_issue.sh` |
| `issue-state` | `issue_state.sh` |
| `permission-grant` | `permission_grant.sh` |
| `checkout-safe-branch` | `checkout_safe_branch.sh` (confirmed: called directly from `discuss-issue`/`enhance-issue` steps, not sourced) |
| `list-agents` | `list_agents.sh` |
| `resolve-plan-paths` | `resolve_plan_paths.sh` (missed by earlier analysis; called directly, has its own usage/shebang) |
| `spawn-issue` | `spawn_issue.sh` (missed by earlier analysis; called directly from `discuss-issue`) |

Leave the existing 4 entries (`dispatch-fixture`, `dispatch-fixture-crash`, `resolve-and-fetch`, `resolve-id-and-file`) untouched.

**Confirmed NOT entrypoints** (sourced-only utilities — guard pattern or explicit "meant to be SOURCED" comment): `agent_email.sh`, `commit_template.sh`, `config_chain.sh`, `git_branch.sh`, `global_config.sh`, `lock.sh`, `merge_body.sh`, `origin.sh`, `push.sh`, `repo_config.sh`, `repo_path.sh`, `tags.sh`, `tag_mutate.sh`, `safe_branch.sh`, `tag_actions.sh`. Also excluded: `engine_dispatch.sh` (the dispatch infrastructure itself), `resolve_and_fetch_shell.sh` and `resolve_id_and_file_shell.sh` (the shell-implementation half of the already-tracked `resolve-and-fetch`/`resolve-id-and-file` entries, invoked internally by the dispatch guard, not separate entrypoints), and `migration-status.json`/test fixtures.

### 3. Skill-level `<skill>/scripts/*.sh` — add ~36 entries with `false`
Verified as independent entrypoints (own `case`/usage dispatcher, called directly by that skill's `.md` steps, not a thin delegating wrapper):

| Skill | Scripts to add (skill-qualified key) |
| --- | --- |
| `arcanum-split-issue` | `create_sub_issue_file.sh`, `create_sub_issue.sh`, `finish.sh`, `push_sub_issues.sh` |
| `arcanum-update` | `run_update.sh` |
| `auto-fix-all` | `checkout_from_main.sh`, `cleanup_artifacts.sh`, `config.sh`, `github.sh`, `queue.sh`, `reply_comment.sh`, `wait_ci_and_merge.sh`, `wait_ci.sh` |
| `auto-fix-issue` | `commit_change.sh`, `create_branch.sh`, `github.sh`, `list_plan_agents.sh`, `list_plan_steps.sh`, `merge_main.sh`, `run_checks.sh` |
| `auto-monitor-issue-pr` | `resolve_pr_number.sh` |
| `auto-monitor-pr` | `monitor_pr.sh` |
| `auto-new-issue` | `commit_issue.sh` |
| `auto-plan-issue` | `commit_plan.sh` |
| `discuss-issue` | `confirm.sh`, `render_issue.sh` |
| `init-claude` | `set_ci_ignored_patterns.sh`, `setup_docs_structure.sh`, `setup_templates.sh`, `stamp_arcanum_version.sh`, `sync_labels.sh`, `write_label_config.sh` |
| `monitor-issues` | `config.sh`, `github.sh`, `monitor_issues.sh`, `rewrite_queue.sh` |

e.g. `auto-fix-all/scripts/config.sh` → key `auto-fix-all-config`; `monitor-issues/scripts/github.sh` → key `monitor-issues-github`.

**Confirmed NOT separate entries** — thin `exec`-only wrappers whose entire body delegates to an already-tracked (or newly-added, see §2) `arcanum/_lib` canonical script; migrating the canonical script covers them automatically:

| Skill-level wrapper | Delegates to (`arcanum/_lib`) |
| --- | --- |
| `arcanum-split-issue/scripts/github.sh`, `auto-new-issue/scripts/github.sh`, `discuss-issue/scripts/github.sh`, `enhance-issue/scripts/github.sh` | `github_issue.sh` |
| `auto-fix-issue/scripts/issue_state.sh` | `issue_state.sh` |
| `auto-fix-issue/scripts/resolve_plan_paths.sh`, `auto-plan-issue/scripts/resolve_plan_paths.sh` | `resolve_plan_paths.sh` |
| `auto-new-issue/scripts/resolve_id_and_file.sh`, `discuss-issue/scripts/resolve_id_and_file.sh` | `resolve_id_and_file.sh` |
| `discuss-issue/scripts/resolve_and_fetch.sh` | `resolve_and_fetch.sh` |
| `auto-plan-issue/scripts/list_agents.sh`, `discuss-issue/scripts/list_agents.sh`, `plan-issue/scripts/list_agents.sh` | `list_agents.sh` |

**Confirmed NOT an entrypoint at all:** `arcanum-split-issue/scripts/test_create_sub_issue_file.sh` — a standalone regression test, not wired into any skill flow (own comment says so; not referenced from any `.md` step), and `init-claude/scripts/lib/label_config.sh` — sourced-only utility.

### 4. Regenerate the table
After editing the JSON, run `scripts/generate_entrypoint_migration_status.sh` to regenerate `docs/agents/architecture/entrypoint-migration-status.md`. New `false` entries are expected to render with a blank `Issue` column (no commit ever introduced `true` for them).

## Benefits
An accurate, complete migration-status table gives a true picture of shell→native migration progress across the whole repo — every entrypoint's status is visible, not just what's already done — and the skill-qualified naming convention prevents future key collisions between skills that happen to share a script basename.
