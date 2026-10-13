# Docker Engine: Migration Checklist

Part of the [Docker Engine spec](../docker.md) (epic #724). This checklist tracks which scripts run under `engine.mode=docker`.

## How to use it

- There is one row per **dispatch command**: every key of `arcanum/_lib/migration-status.json`, plus every native-only command (shims calling `engine_dispatch ... --native-only`). This is the name `engine_dispatch` receives, and therefore its key in `migration-status.json`, which dispatch reads to decide whether the command is docker-ready (see [dispatch.md](dispatch.md#docker-readiness-source-of-truth)). A per-subcommand router produces several rows that share one `script`.
- There is one table per skill folder, so a batch PR touches a single section. The last section lists the scripts that are not routed through `engine_dispatch.sh`, one row per file, each with a non-dispatched kind and status `n/a`.
- **This checklist is hand-maintained.** Each implementation PR ticks its own rows (`status` ✅, plus `issue`) in the same PR, and flips each ticked command's `migration-status.json` value to `"docker"` in that same PR. The evidence a row needs before it is ticked is in [testing.md](testing.md#ticking-a-checklist-row). `host-only` rows have status `n/a` and map to `"host-only"`. While epic #724 is open, any PR that adds or removes a script under `<skill>/scripts/` or `arcanum/_lib/` also adds or removes its row here.
- The repo mount (plus the git common dir for worktrees and the log location) and the fixed env from [environment.md](environment.md#fixed-env) are implicit for every row and not repeated in `mounts`/`env`.

## Columns

| Column | Values |
| --- | --- |
| `command` | Dispatch command name. In the "not routed through dispatch" section, the file name. |
| `script` | Shim path, plus the subcommand(s) where the shim is a router. |
| `kind` | `dispatched` (dual entrypoint, in `migration-status.json`) / `native-only`. In the "not routed through dispatch" section: `sourced` (a library only ever `source`d by other scripts; it runs wherever its caller runs and is unused inside the container, where native code runs) / `wrapper` (a per-skill script that `exec`s a dispatched `arcanum/_lib` shim, covered by that shim's rows) / `bootstrap` (install/update bootstrap, runs before or outside an installed arcanum, so it can never be dispatched). Only `dispatched` and `native-only` rows can ever be ✅. Every non-dispatched kind is permanently `n/a`. |
| `status` | ☐ not docker-ready / ✅ docker-ready / `blocked (no native)` / `n/a`. |
| `credentials` | `none` / `gh` / `git-push (ssh)` / `inherits target` / `?`. `git-push (ssh)` covers any git remote access (fetch or push), whatever the transport. `inherits target` means the command runs the target project's own script, so its needs are that project's. `?` means not determinable yet. |
| `mounts` | Extra mounts beyond the implicit ones (repo, git common dir for worktrees, log location): `global-config:ro`, `gitconfig:ro`, `remote`, `args:ro`/`args:rw`, `host-only`, or `—` for none. Derived by the rule in [mounts.md](mounts.md#deriving-the-checklist-mounts-column). `?` means not determinable yet. |
| `env` | Extra env vars beyond the command's existing `engine_dispatch` allowlist and the fixed env every row gets: `CLAUDE_CONFIG_DIR`, `GIT_CONFIG_GLOBAL`, `GH_TOKEN`, `remote`, or `—` for none. Derived by the rule in [environment.md](environment.md#deriving-the-checklist-env-column). |
| `issue` | The issue that made the command docker-ready. |
| `notes` | Free text, e.g. TTY-owning, long-running. A TTY-owning command takes its exit-4 `FALLBACK=chat` path under docker whenever the call would prompt (see [dispatch.md](dispatch.md#tty)). |

The initial `credentials` values come from each `engine_dispatch` call's env allowlist (`HOME` forwarded usually means `gh` or git remote access), reviewed by hand against the shell implementation.

Shorthands used in `mounts` and `env` (full rules in [mounts.md](mounts.md) and [environment.md](environment.md)):

- `global-config:ro`: `$CLAUDE_CONFIG_DIR/arcanum-config.json`, read-only, plus `CLAUDE_CONFIG_DIR` in env.
- `gitconfig:ro`: the host's global git config file, read-only, plus `GIT_CONFIG_GLOBAL` in env.
- `remote`: git remote access. For an ssh remote, the SSH agent socket and `known_hosts:ro` mounts plus `SSH_AUTH_SOCK`/`GIT_SSH_COMMAND` in env. For an https remote, no extra mount, and `GH_TOKEN` plus the gh credential helper in env.
- `args:ro`/`args:rw`: absolute path arguments outside the repo, mounted one by one at the same path. `args:rw` covers both the `rw` and `rw-mkdir` `--path-arg` modes (see [dispatch.md](dispatch.md#argument-path-declaration)).
- `host-only`: the command never runs in the container. The reason is in `notes`.

## arcanum/_lib

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `checkout-safe-branch` | `arcanum/_lib/checkout_safe_branch.sh` | dispatched | ✅ | git-push (ssh) | gitconfig:ro, remote | GIT_CONFIG_GLOBAL, remote | #748 | The parity case fetches from a local `file://` bare origin. Real ssh transport is covered only by the opt-in ssh parity case (`ARCANUM_DOCKER_PARITY_SSH=1` plus `ARCANUM_DOCKER_PARITY_SSH_REMOTE`), not yet run; https transport is covered by the #747 `resolve-and-fetch` gh case. Known divergence, unconfirmed against a real remote: under `engine.mode=native` the shim runs under `env -i` without `SSH_AUTH_SOCK` allowlisted, so native git over ssh can't use the SSH agent, while docker can through the `remote` need. This applies to every `remote` row. |
| `finish-report` | `arcanum/_lib/finish_report.sh` | dispatched | ✅ | none | — | — | #745 | |
| `github-issue-create` | `arcanum/_lib/github_issue.sh` `create` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro, args:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it creates a GitHub issue. The routing spec covers the docker wiring. `--path-arg=3:ro`: `<file>` is mounted read-only at its own path when it sits outside the repo. |
| `github-issue-fetch` | `arcanum/_lib/github_issue.sh` `fetch` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `github-issue-info` | `arcanum/_lib/github_issue.sh` `info` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | When the global gitconfig sets `user.ghuser`, `gh auth switch` fails in the container because `GH_TOKEN` is set, so a `Warning: gh auth switch --user <x> failed; …` line goes to stderr. Stdout and the exit code are unaffected. This applies to every `gh` row. |
| `github-issue-mark-created` | `arcanum/_lib/github_issue.sh` `mark-created` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `github-issue-mark-enhancing` | `arcanum/_lib/github_issue.sh` `mark-enhancing` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `github-issue-mark-planning` | `arcanum/_lib/github_issue.sh` `mark-planning` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `github-issue-mark-ready` | `arcanum/_lib/github_issue.sh` `mark-ready` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `github-issue-mark-refined` | `arcanum/_lib/github_issue.sh` `mark-refined` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `github-issue-mark-split` | `arcanum/_lib/github_issue.sh` `mark-split` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `github-issue-update` | `arcanum/_lib/github_issue.sh` `update` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro, args:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it overwrites an issue body. The routing spec covers the docker wiring. `--path-arg=4:ro`: `<file>` is mounted read-only at its own path when it sits outside the repo. |
| `issue-state` | `arcanum/_lib/issue_state.sh` | dispatched | ✅ | none | — | — | #745 | |
| `list-agents` | `arcanum/_lib/list_agents.sh` | dispatched | ✅ | none | — | — | #745 | |
| `next-step-prompt` | `arcanum/_lib/next_step_prompt.sh` | dispatched | n/a | none | host-only | — | #760 | Host-only: TTY-owning, it must prompt on the host's real `/dev/tty`, which the container doesn't have. The shim reads the repo path from `--repo` and execs the shell twin on a usage error. |
| `permission-grant-add` | `arcanum/_lib/permission_grant.sh` `add` | dispatched | ✅ | none | args:rw | — | #753 | `--path-arg=2:rw-mkdir`: the directory of `<file>` is mounted read-write when it sits outside the repo, created first if missing (matching native `mkdir -p`). Callers target the repo's own `.claude/settings.json`; an out-of-repo target exposes its whole parent directory read-write (see [mounts.md](mounts.md)). A relative `<file>` assumes the caller's cwd is `<anchor>`: dispatch resolves it against `$PWD`, `PermissionGrant` against `<anchor>`. |
| `resolve-and-fetch` | `arcanum/_lib/resolve_and_fetch.sh` | dispatched | ✅ | gh, git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN, remote | #747 | `remote` because it runs checkout-safe-branch, whose `git fetch` needs git remote access. |
| `resolve-id-and-file` | `arcanum/_lib/resolve_id_and_file.sh` | dispatched | ✅ | none | — | — | #745 | |
| `resolve-plan-paths` | `arcanum/_lib/resolve_plan_paths.sh` | dispatched | ✅ | none | — | — | #745 | |
| `spawn-issue` | `arcanum/_lib/spawn_issue.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro, args:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it creates a GitHub issue. The routing spec covers the docker wiring. `--path-arg=4:ro`: `<body_file>` is mounted read-only at its own path when it sits outside the repo. |
| `dispatch-fixture-crash` | — | dispatched | ✅ | none | — | — | #745 | Test fixture (`core/lib/commands/shared/DispatchFixture.js`), no shim. No shim-level routing spec: covered by the dispatch-level specs and a parity case under `core/spec/docker/`. |

## arcanum-check-config

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-check-config` | `arcanum-check-config/scripts/check_config.sh` | native-only | ✅ | none | global-config:ro | — | #741 | |

## arcanum-create-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-create-issue-publish` | `arcanum-create-issue/scripts/publish.sh` | native-only | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #749 | TTY-owning: under docker, a call without `--confirmed` / `--shipit-confirmed` takes the exit-4 `FALLBACK=chat` path; confirmed calls behave as native. Parity covers invalid input, a missing draft and the no-TTY fallback. The GitHub-writing success path has no parity case, because it would create a real issue. |
| `arcanum-create-issue-start` | `arcanum-create-issue/scripts/start.sh` | native-only | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #749 | TTY-owning: under docker, a call with drafts present and neither `--new` nor `--resume` takes the exit-4 `FALLBACK=chat` path (with `DRAFT=` lines); calls with either flag behave as native. Parity covers invalid input, an unknown and an existing `--resume` draft, `--new`, and the drafts-present fallback, with the native side detached from any terminal (`detachNative`, see [testing.md](testing.md)). |

## arcanum-split-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-split-issue-create-sub-issue` | `arcanum-split-issue/scripts/create_sub_issue.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it creates a GitHub issue. The routing spec covers the docker wiring. Arg 3 `<sub_issue_file>` has no `--path-arg`: a repo-relative path works (the container cwd is the repo), an absolute path outside the repo is not visible in the container. |
| `arcanum-split-issue-create-sub-issue-file` | `arcanum-split-issue/scripts/create_sub_issue_file.sh` | dispatched | ✅ | none | args:ro | — | #746 | `--path-arg=4:ro`: `<body_file>` is mounted read-only at its own path when it sits outside the repo. |
| `arcanum-split-issue-finish` | `arcanum-split-issue/scripts/finish.sh` | dispatched | ✅ | gh, git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN, remote | #748 | No local parity case: `mark-split` relabels the issue on GitHub first and stops on failure, so a local origin can't reach its fetch. It has only an opt-in gh sandbox case (in `arcanumSplitIssue_spec.js`), not yet run. The routing spec covers the docker wiring. |
| `arcanum-split-issue-push-sub-issues` | `arcanum-split-issue/scripts/push_sub_issues.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it creates GitHub issues. The routing spec covers the docker wiring. |

## arcanum-update

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arcanum-update-run-update-apply` | `arcanum-update/scripts/run_update.sh` `apply` | dispatched | n/a | none | host-only | — | | Host-only: updates the host install itself, and `ClaudeContext#validateInstall` ties it to the running install. |
| `arcanum-update-run-update-check` | `arcanum-update/scripts/run_update.sh` `check` | dispatched | n/a | none | host-only | — | | Host-only: inspects the host install, not the image's copy. |

## auto-fix-all

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-fix-all-checkout-from-main` | `auto-fix-all/scripts/checkout_from_main.sh` | dispatched | ✅ | git-push (ssh) | gitconfig:ro, remote | GIT_CONFIG_GLOBAL, remote | #748 | |
| `auto-fix-all-cleanup-artifacts` | `auto-fix-all/scripts/cleanup_artifacts.sh` | dispatched | ✅ | git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, remote | #748 | |
| `auto-fix-all-config-get` | `auto-fix-all/scripts/config.sh` `get` | dispatched | ✅ | none | — | — | #745 | |
| `auto-fix-all-config-is-enabled` | `auto-fix-all/scripts/config.sh` `is-enabled` | dispatched | ✅ | none | — | — | #745 | |
| `auto-fix-all-config-set` | `auto-fix-all/scripts/config.sh` `set` | dispatched | ✅ | none | — | — | #745 | |
| `auto-fix-all-config-toggle` | `auto-fix-all/scripts/config.sh` `toggle` | dispatched | ✅ | none | — | — | #745 | |
| `auto-fix-all-github-add-tag` | `auto-fix-all/scripts/github.sh` `add-tag` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-all-github-cleanup-branch` | `auto-fix-all/scripts/github.sh` `cleanup-branch` | dispatched | ✅ | git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, remote | #748 | |
| `auto-fix-all-github-has-label` | `auto-fix-all/scripts/github.sh` `has-label`, `has-shipit-label` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-all-github-pr-merge` | `auto-fix-all/scripts/github.sh` `pr-merge` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it merges a PR. The routing spec covers the docker wiring. |
| `auto-fix-all-github-pr-number` | `auto-fix-all/scripts/github.sh` `pr-number` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-all-github-pr-state` | `auto-fix-all/scripts/github.sh` `pr-state` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-all-github-remove-tag` | `auto-fix-all/scripts/github.sh` `remove-tag` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-all-queue-empty` | `auto-fix-all/scripts/queue.sh` `empty` | dispatched | ✅ | none | — | — | #745 | Credentials corrected from `gh` in #726: it never touches GitHub (only `save`/`push` tag issues). |
| `auto-fix-all-queue-list` | `auto-fix-all/scripts/queue.sh` `list` | dispatched | ✅ | none | — | — | #745 | Credentials corrected from `gh` in #726: it never touches GitHub (only `save`/`push` tag issues). |
| `auto-fix-all-queue-next` | `auto-fix-all/scripts/queue.sh` `next` | dispatched | ✅ | none | — | — | #745 | Credentials corrected from `gh` in #726: it never touches GitHub (only `save`/`push` tag issues). |
| `auto-fix-all-queue-pop` | `auto-fix-all/scripts/queue.sh` `pop` | dispatched | ✅ | none | — | — | #745 | Credentials corrected from `gh` in #726: it never touches GitHub (only `save`/`push` tag issues). |
| `auto-fix-all-queue-push` | `auto-fix-all/scripts/queue.sh` `push` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-all-queue-save` | `auto-fix-all/scripts/queue.sh` `save` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-all-queue-wait-next` | `auto-fix-all/scripts/queue.sh` `wait-next` | dispatched | ✅ | none | — | — | #745 | Credentials corrected from `gh` in #726: it never touches GitHub (only `save`/`push` tag issues). Blocks until the queue has an entry. The parity case seeds the queue first, so the blocking call returns at once. |
| `auto-fix-all-reply-comment` | `auto-fix-all/scripts/reply_comment.sh` | dispatched | ✅ | gh, git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN, remote | #748 | No parity case: its success path posts a PR comment on GitHub. The routing spec covers the docker wiring. |
| `auto-fix-all-wait-ci` | `auto-fix-all/scripts/wait_ci.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | Blocks until CI completes. No parity case: it blocks on CI. The routing spec covers the docker wiring. |
| `auto-fix-all-wait-ci-and-merge` | `auto-fix-all/scripts/wait_ci_and_merge.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | Blocks until CI completes. No parity case: it blocks on CI and merges a PR. The routing spec covers the docker wiring. |

## auto-fix-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-fix-issue-commit-change` | `auto-fix-issue/scripts/commit_change.sh` | dispatched | ✅ | git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, remote | #748 | |
| `auto-fix-issue-github-info` | `auto-fix-issue/scripts/github.sh` `info` | dispatched | ✅ | none | — | — | #745 | |
| `auto-fix-issue-github-pr-create` | `auto-fix-issue/scripts/github.sh` `pr-create` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro, args:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it creates a PR. The routing spec covers the docker wiring. `--path-arg=3:ro`: `<file>` is mounted read-only at its own path when it sits outside the repo. |
| `auto-fix-issue-github-pr-ready` | `auto-fix-issue/scripts/github.sh` `pr-ready` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it changes a PR's state. The routing spec covers the docker wiring. |
| `auto-fix-issue-github-pr-view` | `auto-fix-issue/scripts/github.sh` `pr-view` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `auto-fix-issue-list-plan-agents` | `auto-fix-issue/scripts/list_plan_agents.sh` | dispatched | ✅ | none | — | — | #745 | |
| `auto-fix-issue-list-plan-steps` | `auto-fix-issue/scripts/list_plan_steps.sh` | dispatched | ✅ | none | — | — | #745 | |
| `auto-fix-issue-run-checks` | `auto-fix-issue/scripts/run_checks.sh` | dispatched | n/a | inherits target | host-only | — | | Host-only (decided in #727): runs the target project's own `.claude/scripts/check_<agent>.sh`, whose toolchain the image doesn't have. Its credentials and mounts are the target project's. |

## auto-monitor-issue-pr

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-monitor-issue-pr-resolve-pr-number` | `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |

## auto-monitor-pr

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-monitor-pr-monitor-pr` | `auto-monitor-pr/scripts/monitor_pr.sh` | dispatched | ✅ | gh, git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN, remote | #748 | Pushes only to restart monitoring after fixes. The local parity case covers only the best-effort push and the `pending` result; GitHub polling and reactions are not covered by parity. |

## auto-new-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-new-issue-commit-issue` | `auto-new-issue/scripts/commit_issue.sh` | dispatched | ✅ | git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, remote | #748 | |

## auto-plan-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auto-plan-issue-auto-next` | `auto-plan-issue/scripts/auto_next.sh` | dispatched | n/a | git-push (ssh) | host-only | — | #760 | Host-only: it runs `next-step-prompt` in-process (a `host-only` command) and pushes with the host's git credentials. `GIT_CONFIG_GLOBAL`, `SSH_AUTH_SOCK` and `GIT_SSH_COMMAND` are forwarded to the native path so the host-side push can use the SSH agent. |
| `auto-plan-issue-commit-plan` | `auto-plan-issue/scripts/commit_plan.sh` | dispatched | ✅ | git-push (ssh) | global-config:ro, gitconfig:ro, remote | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, remote | #748 | |

## discuss-issue

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `discuss-issue-confirm` | `discuss-issue/scripts/confirm.sh` | dispatched | ✅ | none | — | — | #745 | |
| `discuss-issue-render-issue` | `discuss-issue/scripts/render_issue.sh` | dispatched | ✅ | none | args:rw | — | #746 | `--path-arg=1:rw`: the directory of `<output_file>` is mounted read-write when it sits outside the repo. |

## init-claude

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `init-claude-set-ci-ignored-patterns` | `init-claude/scripts/set_ci_ignored_patterns.sh` | dispatched | ✅ | none | — | — | #745 | |
| `init-claude-set-next-step-auto` | `init-claude/scripts/set_next_step_auto.sh` | native-only | ✅ | none | — | — | #745 | |
| `init-claude-setup-docs-structure` | `init-claude/scripts/setup_docs_structure.sh` | dispatched | ✅ | none | — | — | #745 | |
| `init-claude-setup-templates` | `init-claude/scripts/setup_templates.sh` | dispatched | ✅ | none | — | — | #745 | |
| `init-claude-stamp-arcanum-version` | `init-claude/scripts/stamp_arcanum_version.sh` | dispatched | ✅ | none | global-config:ro | CLAUDE_CONFIG_DIR | #746 | `--needs=global-config`. `global-config:ro` follows the `HOME` allowlist rule: `HOME` stays in the allowlist so that, natively, `git describe` resolves a git-clone install's tag. Under docker the version comes from the image's own `arcanum.json` instead. On a dev install between tags (e.g. `2.0.0-15-ge7a86db`), native resolves no version and stamps nothing. Against the image dispatch picks for that install (`darthjee/arcanum:local-<sha>`) docker also stamps nothing, so parity holds. Against an image whose `arcanum.json` carries a release version (e.g. one built with `ARCANUM_VERSION=2.0.0`), docker stamps that version into `.claude/configuration/arcanum-repo-config.json` and `.claude/state/arcanum-config.json` (`migrations.version`) while native does not. The parity spec pins this with a divergence case. |
| `init-claude-sync-labels` | `init-claude/scripts/sync_labels.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro, args:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | No parity case: it edits the repo's labels. The routing spec covers the docker wiring. `--path-arg=2:ro`: `<abs_config_path>` is mounted read-only at its own path when it sits outside the repo. |
| `init-claude-write-label-config-add` | `init-claude/scripts/write_label_config.sh` `add` | dispatched | ✅ | none | args:rw | — | #746 | `--path-arg=1:rw-mkdir`: the directory of the absolute `<config_path>` is mounted read-write when it sits outside the repo, created first if missing (matching native `mkdir -p`). |
| `init-claude-write-label-config-remove` | `init-claude/scripts/write_label_config.sh` `remove` | dispatched | ✅ | none | args:rw | — | #746 | `--path-arg=1:rw-mkdir`: the directory of the absolute `<config_path>` is mounted read-write when it sits outside the repo, created first if missing (matching native `mkdir -p`). |
| `init-claude-write-label-config-replace` | `init-claude/scripts/write_label_config.sh` `replace` | dispatched | ✅ | none | args:rw | — | #746 | `--path-arg=1:rw-mkdir`: the directory of the absolute `<config_path>` is mounted read-write when it sits outside the repo, created first if missing (matching native `mkdir -p`). |

## monitor-issues

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `monitor-issues-config-get` | `monitor-issues/scripts/config.sh` `get` | dispatched | ✅ | none | — | — | #745 | |
| `monitor-issues-config-is-enabled` | `monitor-issues/scripts/config.sh` `is-enabled` | dispatched | ✅ | none | — | — | #745 | |
| `monitor-issues-config-set` | `monitor-issues/scripts/config.sh` `set` | dispatched | ✅ | none | — | — | #745 | |
| `monitor-issues-config-toggle` | `monitor-issues/scripts/config.sh` `toggle` | dispatched | ✅ | none | — | — | #745 | |
| `monitor-issues-github-remove-tag` | `monitor-issues/scripts/github.sh` `remove-tag` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | |
| `monitor-issues-monitor-issues` | `monitor-issues/scripts/monitor_issues.sh` | dispatched | ✅ | gh | global-config:ro, gitconfig:ro | CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN | #747 | Long-running polling loop. No parity case: it never returns on its own. The routing spec covers the docker wiring. The shim backgrounds the dispatch call and stops it with `pkill -P`, which reaches the `docker` CLI, not the container: the container stops only through `docker run`'s default `--sig-proxy`. The fake docker models this and a spec covers it; not verified against a real long-running container. |
| `monitor-issues-rewrite-queue-pop` | `monitor-issues/scripts/rewrite_queue.sh` `pop` | dispatched | ✅ | none | — | — | #745 | |
| `monitor-issues-rewrite-queue-push` | `monitor-issues/scripts/rewrite_queue.sh` `push` | dispatched | ✅ | none | — | — | #745 | |

## Not routed through dispatch

Scripts under `<skill>/scripts/` and `arcanum/_lib/` that are not routed through `engine_dispatch.sh` (excluding shell twins and `test_*` files), plus the install/update bootstraps. Each row has a non-dispatched kind and is permanently `n/a`: `sourced` libraries run wherever their caller runs, each `wrapper` is covered by the dispatched row named in its `notes`, and a `bootstrap` can never be dispatched. The full rule is in [dispatch.md](dispatch.md#scripts-not-routed-through-dispatch) (#733). The two former `entrypoint`s, `next_step_prompt.sh` and `auto_next.sh`, became dispatched `host-only` commands in #760 and moved to their skill sections.

| command | script | kind | status | credentials | mounts | env | issue | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `github.sh` | `arcanum-split-issue/scripts/github.sh` | wrapper | n/a | | | | #733 | Covered by the `github-issue-*` rows. |
| `run_update_common.sh` | `arcanum-update/scripts/run_update_common.sh` | sourced | n/a | | | | #733 | |
| `agent_email.sh` | `arcanum/_lib/agent_email.sh` | sourced | n/a | | | | #733 | |
| `commit_template.sh` | `arcanum/_lib/commit_template.sh` | sourced | n/a | | | | #733 | |
| `config_chain.sh` | `arcanum/_lib/config_chain.sh` | sourced | n/a | | | | #733 | |
| `git_branch.sh` | `arcanum/_lib/git_branch.sh` | sourced | n/a | | | | #733 | |
| `global_config.sh` | `arcanum/_lib/global_config.sh` | sourced | n/a | | | | #733 | |
| `lock.sh` | `arcanum/_lib/lock.sh` | sourced | n/a | | | | #733 | |
| `merge_body.sh` | `arcanum/_lib/merge_body.sh` | sourced | n/a | | | | #733 | Sourced, not an entrypoint. |
| `origin.sh` | `arcanum/_lib/origin.sh` | sourced | n/a | | | | #733 | |
| `push.sh` | `arcanum/_lib/push.sh` | sourced | n/a | | | | #733 | Sourced, not an entrypoint. |
| `repo_config.sh` | `arcanum/_lib/repo_config.sh` | sourced | n/a | | | | #733 | |
| `repo_path.sh` | `arcanum/_lib/repo_path.sh` | sourced | n/a | | | | #733 | |
| `safe_branch.sh` | `arcanum/_lib/safe_branch.sh` | sourced | n/a | | | | #733 | |
| `tag_actions.sh` | `arcanum/_lib/tag_actions.sh` | sourced | n/a | | | | #733 | |
| `tag_mutate.sh` | `arcanum/_lib/tag_mutate.sh` | sourced | n/a | | | | #733 | |
| `tags.sh` | `arcanum/_lib/tags.sh` | sourced | n/a | | | | #733 | |
| `config_common.sh` | `auto-fix-all/scripts/config_common.sh` | sourced | n/a | | | | #733 | |
| `queue_common.sh` | `auto-fix-all/scripts/queue_common.sh` | sourced | n/a | | | | #733 | |
| `issue_state.sh` | `auto-fix-issue/scripts/issue_state.sh` | wrapper | n/a | | | | #733 | Covered by the `issue-state` row. |
| `resolve_plan_paths.sh` | `auto-fix-issue/scripts/resolve_plan_paths.sh` | wrapper | n/a | | | | #733 | Covered by the `resolve-plan-paths` row. |
| `github.sh` | `auto-new-issue/scripts/github.sh` | wrapper | n/a | | | | #733 | Covered by the `github-issue-*` rows. |
| `resolve_id_and_file.sh` | `auto-new-issue/scripts/resolve_id_and_file.sh` | wrapper | n/a | | | | #733 | Covered by the `resolve-id-and-file` row. |
| `list_agents.sh` | `auto-plan-issue/scripts/list_agents.sh` | wrapper | n/a | | | | #733 | Covered by the `list-agents` row. |
| `resolve_plan_paths.sh` | `auto-plan-issue/scripts/resolve_plan_paths.sh` | wrapper | n/a | | | | #733 | Covered by the `resolve-plan-paths` row. |
| `github.sh` | `discuss-issue/scripts/github.sh` | wrapper | n/a | | | | #733 | Covered by the `github-issue-*` rows. |
| `list_agents.sh` | `discuss-issue/scripts/list_agents.sh` | wrapper | n/a | | | | #733 | Covered by the `list-agents` row. |
| `resolve_and_fetch.sh` | `discuss-issue/scripts/resolve_and_fetch.sh` | wrapper | n/a | | | | #733 | Covered by the `resolve-and-fetch` row. |
| `resolve_id_and_file.sh` | `discuss-issue/scripts/resolve_id_and_file.sh` | wrapper | n/a | | | | #733 | Covered by the `resolve-id-and-file` row. |
| `github.sh` | `enhance-issue/scripts/github.sh` | wrapper | n/a | | | | #733 | Covered by the `github-issue-*` rows. |
| `config_common.sh` | `monitor-issues/scripts/config_common.sh` | sourced | n/a | | | | #733 | |
| `rewrite_queue_common.sh` | `monitor-issues/scripts/rewrite_queue_common.sh` | sourced | n/a | | | | #733 | |
| `list_agents.sh` | `plan-issue/scripts/list_agents.sh` | wrapper | n/a | | | | #733 | Covered by the `list-agents` row. |
| `bootstrap.sh` | `arcanum/install/bootstrap.sh` | bootstrap | n/a | | | | #733 | Runs before or outside an installed arcanum. |
| `installer.sh` | `arcanum/install/installer.sh` | bootstrap | n/a | | | | #733 | Runs before or outside an installed arcanum. |
| `bootstrap.sh` | `arcanum/update/bootstrap.sh` | bootstrap | n/a | | | | #733 | Runs before or outside an installed arcanum. |
| `updater.sh` | `arcanum/update/updater.sh` | bootstrap | n/a | | | | #733 | Runs before or outside an installed arcanum. |
