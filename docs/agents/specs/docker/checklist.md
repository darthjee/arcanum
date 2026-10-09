# Docker Engine: Migration Checklist

Part of the [Docker Engine spec](../docker.md) (epic #724). This checklist tracks which scripts run under `engine.mode=docker`.

## How to use it

- There is one row per **dispatch command**: every key of `arcanum/_lib/migration-status.json`, plus every native-only command (shims calling `engine_dispatch ... --native-only`). This is the name `engine_dispatch` receives, and therefore the key the docker-readiness lookup uses (#727). A per-subcommand router produces several rows that share one `script`.
- There is one table per skill folder, so a batch PR touches a single section. The last section lists the scripts that are not routed through `engine_dispatch.sh`, one row per file, pending #733.
- **This checklist is hand-maintained.** Each implementation PR ticks its own rows (`status` ✅, plus `issue`) in the same PR. While epic #724 is open, any PR that adds or removes a script under `<skill>/scripts/` or `arcanum/_lib/` also adds or removes its row here.
- The repo mount is implicit for every row and is not repeated in `mounts`.

## Columns

| Column | Values |
| --- | --- |
| `command` | Dispatch command name. In the "not routed through dispatch" section, the file name. |
| `script` | Shim path, plus the subcommand(s) where the shim is a router. |
| `kind` | `dispatched` (dual entrypoint, in `migration-status.json`) / `native-only` / `TBD (#733)`. |
| `status` | ☐ not docker-ready / ✅ docker-ready / `blocked (no native)` / `n/a`. |
| `credentials` | `none` / `gh` / `git-push (ssh)` / `?`. `git-push (ssh)` covers any git remote access (fetch or push). `?` means unsure, to be confirmed by #726. |
| `mounts` | Extra paths beyond the repo, each tagged `ro`/`rw` (e.g. `CLAUDE_CONFIG_DIR:rw`). `?` until #726. |
| `env` | Extra env vars beyond the command's existing `engine_dispatch` allowlist. |
| `issue` | The issue that made the command docker-ready. |
| `notes` | Free text, e.g. TTY-owning, long-running. |

The initial `credentials` values come from each `engine_dispatch` call's env allowlist (`HOME` forwarded usually means `gh` or git remote access), reviewed by hand against the shell implementation.

## arcanum/_lib

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `checkout-safe-branch` | `arcanum/_lib/checkout_safe_branch.sh` | dispatched | ☐ | git-push (ssh) | ? | | | |
| `finish-report` | `arcanum/_lib/finish_report.sh` | dispatched | ☐ | none | ? | | | |
| `github-issue-create` | `arcanum/_lib/github_issue.sh` `create` | dispatched | ☐ | gh | ? | | | |
| `github-issue-fetch` | `arcanum/_lib/github_issue.sh` `fetch` | dispatched | ☐ | gh | ? | | | |
| `github-issue-info` | `arcanum/_lib/github_issue.sh` `info` | dispatched | ☐ | gh | ? | | | |
| `github-issue-mark-created` | `arcanum/_lib/github_issue.sh` `mark-created` | dispatched | ☐ | gh | ? | | | |
| `github-issue-mark-enhancing` | `arcanum/_lib/github_issue.sh` `mark-enhancing` | dispatched | ☐ | gh | ? | | | |
| `github-issue-mark-planning` | `arcanum/_lib/github_issue.sh` `mark-planning` | dispatched | ☐ | gh | ? | | | |
| `github-issue-mark-ready` | `arcanum/_lib/github_issue.sh` `mark-ready` | dispatched | ☐ | gh | ? | | | |
| `github-issue-mark-refined` | `arcanum/_lib/github_issue.sh` `mark-refined` | dispatched | ☐ | gh | ? | | | |
| `github-issue-mark-split` | `arcanum/_lib/github_issue.sh` `mark-split` | dispatched | ☐ | gh | ? | | | |
| `github-issue-update` | `arcanum/_lib/github_issue.sh` `update` | dispatched | ☐ | gh | ? | | | |
| `issue-state` | `arcanum/_lib/issue_state.sh` | dispatched | ☐ | none | ? | | | |
| `list-agents` | `arcanum/_lib/list_agents.sh` | dispatched | ☐ | none | ? | | | |
| `permission-grant-add` | `arcanum/_lib/permission_grant.sh` `add` | dispatched | ☐ | none | ? | | | |
| `resolve-and-fetch` | `arcanum/_lib/resolve_and_fetch.sh` | dispatched | ☐ | gh | ? | | | |
| `resolve-id-and-file` | `arcanum/_lib/resolve_id_and_file.sh` | dispatched | ☐ | none | ? | | | |
| `resolve-plan-paths` | `arcanum/_lib/resolve_plan_paths.sh` | dispatched | ☐ | none | ? | | | |
| `spawn-issue` | `arcanum/_lib/spawn_issue.sh` | dispatched | ☐ | gh | ? | | | |
| `dispatch-fixture-crash` | — | dispatched | ☐ | none | ? | | | Test fixture (`core/lib/commands/shared/DispatchFixture.js`), no shim. |

## arcanum-check-config

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-check-config` | `arcanum-check-config/scripts/check_config.sh` | native-only | ☐ | none | ? | | | |

## arcanum-create-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-create-issue-publish` | `arcanum-create-issue/scripts/publish.sh` | native-only | ☐ | gh | ? | | | TTY-owning. |
| `arcanum-create-issue-start` | `arcanum-create-issue/scripts/start.sh` | native-only | ☐ | gh | ? | | | TTY-owning. |

## arcanum-split-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-split-issue-create-sub-issue` | `arcanum-split-issue/scripts/create_sub_issue.sh` | dispatched | ☐ | gh | ? | | | |
| `arcanum-split-issue-create-sub-issue-file` | `arcanum-split-issue/scripts/create_sub_issue_file.sh` | dispatched | ☐ | none | ? | | | |
| `arcanum-split-issue-finish` | `arcanum-split-issue/scripts/finish.sh` | dispatched | ☐ | gh, git-push (ssh) | ? | | | |
| `arcanum-split-issue-push-sub-issues` | `arcanum-split-issue/scripts/push_sub_issues.sh` | dispatched | ☐ | gh | ? | | | |

## arcanum-update

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-update-run-update-apply` | `arcanum-update/scripts/run_update.sh` `apply` | dispatched | ☐ | none | ? | | | |
| `arcanum-update-run-update-check` | `arcanum-update/scripts/run_update.sh` `check` | dispatched | ☐ | none | ? | | | |

## auto-fix-all

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-fix-all-checkout-from-main` | `auto-fix-all/scripts/checkout_from_main.sh` | dispatched | ☐ | git-push (ssh) | ? | | | |
| `auto-fix-all-cleanup-artifacts` | `auto-fix-all/scripts/cleanup_artifacts.sh` | dispatched | ☐ | git-push (ssh) | ? | | | |
| `auto-fix-all-config-get` | `auto-fix-all/scripts/config.sh` `get` | dispatched | ☐ | none | ? | | | |
| `auto-fix-all-config-is-enabled` | `auto-fix-all/scripts/config.sh` `is-enabled` | dispatched | ☐ | none | ? | | | |
| `auto-fix-all-config-set` | `auto-fix-all/scripts/config.sh` `set` | dispatched | ☐ | none | ? | | | |
| `auto-fix-all-config-toggle` | `auto-fix-all/scripts/config.sh` `toggle` | dispatched | ☐ | none | ? | | | |
| `auto-fix-all-github-add-tag` | `auto-fix-all/scripts/github.sh` `add-tag` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-github-cleanup-branch` | `auto-fix-all/scripts/github.sh` `cleanup-branch` | dispatched | ☐ | git-push (ssh) | ? | | | |
| `auto-fix-all-github-has-label` | `auto-fix-all/scripts/github.sh` `has-label`, `has-shipit-label` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-github-pr-merge` | `auto-fix-all/scripts/github.sh` `pr-merge` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-github-pr-number` | `auto-fix-all/scripts/github.sh` `pr-number` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-github-pr-state` | `auto-fix-all/scripts/github.sh` `pr-state` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-github-remove-tag` | `auto-fix-all/scripts/github.sh` `remove-tag` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-queue-empty` | `auto-fix-all/scripts/queue.sh` `empty` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-queue-list` | `auto-fix-all/scripts/queue.sh` `list` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-queue-next` | `auto-fix-all/scripts/queue.sh` `next` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-queue-pop` | `auto-fix-all/scripts/queue.sh` `pop` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-queue-push` | `auto-fix-all/scripts/queue.sh` `push` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-queue-save` | `auto-fix-all/scripts/queue.sh` `save` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-all-queue-wait-next` | `auto-fix-all/scripts/queue.sh` `wait-next` | dispatched | ☐ | gh | ? | | | Blocks until the queue has an entry. |
| `auto-fix-all-reply-comment` | `auto-fix-all/scripts/reply_comment.sh` | dispatched | ☐ | gh, git-push (ssh) | ? | | | |
| `auto-fix-all-wait-ci` | `auto-fix-all/scripts/wait_ci.sh` | dispatched | ☐ | gh | ? | | | Blocks until CI completes. |
| `auto-fix-all-wait-ci-and-merge` | `auto-fix-all/scripts/wait_ci_and_merge.sh` | dispatched | ☐ | gh | ? | | | Blocks until CI completes. |

## auto-fix-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-fix-issue-commit-change` | `auto-fix-issue/scripts/commit_change.sh` | dispatched | ☐ | git-push (ssh) | ? | | | |
| `auto-fix-issue-github-info` | `auto-fix-issue/scripts/github.sh` `info` | dispatched | ☐ | none | ? | | | |
| `auto-fix-issue-github-pr-create` | `auto-fix-issue/scripts/github.sh` `pr-create` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-issue-github-pr-ready` | `auto-fix-issue/scripts/github.sh` `pr-ready` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-issue-github-pr-view` | `auto-fix-issue/scripts/github.sh` `pr-view` | dispatched | ☐ | gh | ? | | | |
| `auto-fix-issue-list-plan-agents` | `auto-fix-issue/scripts/list_plan_agents.sh` | dispatched | ☐ | none | ? | | | |
| `auto-fix-issue-list-plan-steps` | `auto-fix-issue/scripts/list_plan_steps.sh` | dispatched | ☐ | none | ? | | | |
| `auto-fix-issue-run-checks` | `auto-fix-issue/scripts/run_checks.sh` | dispatched | ☐ | ? | ? | | | Runs the target project's own `.claude/scripts/check_<agent>.sh`; its needs depend on that script. |

## auto-monitor-issue-pr

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-monitor-issue-pr-resolve-pr-number` | `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` | dispatched | ☐ | gh | ? | | | |

## auto-monitor-pr

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-monitor-pr-monitor-pr` | `auto-monitor-pr/scripts/monitor_pr.sh` | dispatched | ☐ | gh, git-push (ssh) | ? | | | Pushes only to restart monitoring after fixes. |

## auto-new-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-new-issue-commit-issue` | `auto-new-issue/scripts/commit_issue.sh` | dispatched | ☐ | git-push (ssh) | ? | | | |

## auto-plan-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-plan-issue-commit-plan` | `auto-plan-issue/scripts/commit_plan.sh` | dispatched | ☐ | git-push (ssh) | ? | | | |

## discuss-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `discuss-issue-confirm` | `discuss-issue/scripts/confirm.sh` | dispatched | ☐ | none | ? | | | |
| `discuss-issue-render-issue` | `discuss-issue/scripts/render_issue.sh` | dispatched | ☐ | none | ? | | | |

## init-claude

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `init-claude-set-ci-ignored-patterns` | `init-claude/scripts/set_ci_ignored_patterns.sh` | dispatched | ☐ | none | ? | | | |
| `init-claude-set-next-step-auto` | `init-claude/scripts/set_next_step_auto.sh` | native-only | ☐ | none | ? | | | |
| `init-claude-setup-docs-structure` | `init-claude/scripts/setup_docs_structure.sh` | dispatched | ☐ | none | ? | | | |
| `init-claude-setup-templates` | `init-claude/scripts/setup_templates.sh` | dispatched | ☐ | none | ? | | | |
| `init-claude-stamp-arcanum-version` | `init-claude/scripts/stamp_arcanum_version.sh` | dispatched | ☐ | none | ? | | | |
| `init-claude-sync-labels` | `init-claude/scripts/sync_labels.sh` | dispatched | ☐ | gh | ? | | | |
| `init-claude-write-label-config-add` | `init-claude/scripts/write_label_config.sh` `add` | dispatched | ☐ | none | ? | | | |
| `init-claude-write-label-config-remove` | `init-claude/scripts/write_label_config.sh` `remove` | dispatched | ☐ | none | ? | | | |
| `init-claude-write-label-config-replace` | `init-claude/scripts/write_label_config.sh` `replace` | dispatched | ☐ | none | ? | | | |

## monitor-issues

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `monitor-issues-config-get` | `monitor-issues/scripts/config.sh` `get` | dispatched | ☐ | none | ? | | | |
| `monitor-issues-config-is-enabled` | `monitor-issues/scripts/config.sh` `is-enabled` | dispatched | ☐ | none | ? | | | |
| `monitor-issues-config-set` | `monitor-issues/scripts/config.sh` `set` | dispatched | ☐ | none | ? | | | |
| `monitor-issues-config-toggle` | `monitor-issues/scripts/config.sh` `toggle` | dispatched | ☐ | none | ? | | | |
| `monitor-issues-github-remove-tag` | `monitor-issues/scripts/github.sh` `remove-tag` | dispatched | ☐ | gh | ? | | | |
| `monitor-issues-monitor-issues` | `monitor-issues/scripts/monitor_issues.sh` | dispatched | ☐ | gh | ? | | | Long-running polling loop. |
| `monitor-issues-rewrite-queue-pop` | `monitor-issues/scripts/rewrite_queue.sh` `pop` | dispatched | ☐ | none | ? | | | |
| `monitor-issues-rewrite-queue-push` | `monitor-issues/scripts/rewrite_queue.sh` `push` | dispatched | ☐ | none | ? | | | |

## Not routed through dispatch (pending #733)

Scripts under `<skill>/scripts/` and `arcanum/_lib/` that are not routed through `engine_dispatch.sh` (excluding shell twins and `test_*` files), plus the install/update bootstraps: sourced libraries, thin per-skill wrappers, non-dispatched entrypoints. How each kind behaves under docker is decided in #733.

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `github.sh` | `arcanum-split-issue/scripts/github.sh` | TBD (#733) | n/a | | | | | |
| `run_update_common.sh` | `arcanum-update/scripts/run_update_common.sh` | TBD (#733) | n/a | | | | | |
| `agent_email.sh` | `arcanum/_lib/agent_email.sh` | TBD (#733) | n/a | | | | | |
| `commit_template.sh` | `arcanum/_lib/commit_template.sh` | TBD (#733) | n/a | | | | | |
| `config_chain.sh` | `arcanum/_lib/config_chain.sh` | TBD (#733) | n/a | | | | | |
| `git_branch.sh` | `arcanum/_lib/git_branch.sh` | TBD (#733) | n/a | | | | | |
| `global_config.sh` | `arcanum/_lib/global_config.sh` | TBD (#733) | n/a | | | | | |
| `lock.sh` | `arcanum/_lib/lock.sh` | TBD (#733) | n/a | | | | | |
| `merge_body.sh` | `arcanum/_lib/merge_body.sh` | TBD (#733) | n/a | | | | | |
| `next_step_prompt.sh` | `arcanum/_lib/next_step_prompt.sh` | TBD (#733) | n/a | | | | | |
| `origin.sh` | `arcanum/_lib/origin.sh` | TBD (#733) | n/a | | | | | |
| `push.sh` | `arcanum/_lib/push.sh` | TBD (#733) | n/a | | | | | |
| `repo_config.sh` | `arcanum/_lib/repo_config.sh` | TBD (#733) | n/a | | | | | |
| `repo_path.sh` | `arcanum/_lib/repo_path.sh` | TBD (#733) | n/a | | | | | |
| `safe_branch.sh` | `arcanum/_lib/safe_branch.sh` | TBD (#733) | n/a | | | | | |
| `tag_actions.sh` | `arcanum/_lib/tag_actions.sh` | TBD (#733) | n/a | | | | | |
| `tag_mutate.sh` | `arcanum/_lib/tag_mutate.sh` | TBD (#733) | n/a | | | | | |
| `tags.sh` | `arcanum/_lib/tags.sh` | TBD (#733) | n/a | | | | | |
| `config_common.sh` | `auto-fix-all/scripts/config_common.sh` | TBD (#733) | n/a | | | | | |
| `queue_common.sh` | `auto-fix-all/scripts/queue_common.sh` | TBD (#733) | n/a | | | | | |
| `issue_state.sh` | `auto-fix-issue/scripts/issue_state.sh` | TBD (#733) | n/a | | | | | |
| `resolve_plan_paths.sh` | `auto-fix-issue/scripts/resolve_plan_paths.sh` | TBD (#733) | n/a | | | | | |
| `github.sh` | `auto-new-issue/scripts/github.sh` | TBD (#733) | n/a | | | | | |
| `resolve_id_and_file.sh` | `auto-new-issue/scripts/resolve_id_and_file.sh` | TBD (#733) | n/a | | | | | |
| `auto_next.sh` | `auto-plan-issue/scripts/auto_next.sh` | TBD (#733) | n/a | | | | | |
| `list_agents.sh` | `auto-plan-issue/scripts/list_agents.sh` | TBD (#733) | n/a | | | | | |
| `resolve_plan_paths.sh` | `auto-plan-issue/scripts/resolve_plan_paths.sh` | TBD (#733) | n/a | | | | | |
| `github.sh` | `discuss-issue/scripts/github.sh` | TBD (#733) | n/a | | | | | |
| `list_agents.sh` | `discuss-issue/scripts/list_agents.sh` | TBD (#733) | n/a | | | | | |
| `resolve_and_fetch.sh` | `discuss-issue/scripts/resolve_and_fetch.sh` | TBD (#733) | n/a | | | | | |
| `resolve_id_and_file.sh` | `discuss-issue/scripts/resolve_id_and_file.sh` | TBD (#733) | n/a | | | | | |
| `github.sh` | `enhance-issue/scripts/github.sh` | TBD (#733) | n/a | | | | | |
| `config_common.sh` | `monitor-issues/scripts/config_common.sh` | TBD (#733) | n/a | | | | | |
| `rewrite_queue_common.sh` | `monitor-issues/scripts/rewrite_queue_common.sh` | TBD (#733) | n/a | | | | | |
| `list_agents.sh` | `plan-issue/scripts/list_agents.sh` | TBD (#733) | n/a | | | | | |
| `bootstrap.sh` | `arcanum/install/bootstrap.sh` | TBD (#733) | n/a | | | | | |
| `installer.sh` | `arcanum/install/installer.sh` | TBD (#733) | n/a | | | | | |
| `bootstrap.sh` | `arcanum/update/bootstrap.sh` | TBD (#733) | n/a | | | | | |
| `updater.sh` | `arcanum/update/updater.sh` | TBD (#733) | n/a | | | | | |
