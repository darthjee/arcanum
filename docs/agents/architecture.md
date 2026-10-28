# Architecture

This is a hub into arcanum's internals, split by topic into `docs/agents/architecture/*.md`. Start with whichever file below matches what you need — each one reads standalone.

| File | Covers |
| --- | --- |
| [Overview and Source Code Layout](architecture/overview-and-layout.md) | What this repo is (a set of markdown-driven skills, no runtime), and how a skill folder is laid out. |
| [Install & Release Pipeline](architecture/install-and-release.md) | The `curl \| bash` bootstrap/installer two-stage install flow, the release zip, the `arcanum-cli` npm package (layout, manifest, build output, version lockstep, trusted publishing and recovery), and the `update` flow that brings an existing install current. |
| [CLI Install](architecture/cli-install.md) | The shared `arcanum-cli` client step (`arcanum/_lib/install_cli.sh`): its shared rules, version pinning, already-installed handling and exact outcome wording, and how the installer, the updater, `/arcanum-update` and the global migration call it. |
| [Script Preference](architecture/script-preference.md) | Why deterministic logic belongs in `<skill>/scripts/`, not in markdown prose. |
| [Agent Roster and Architect Delegation](architecture/agent-roster-and-delegation.md) | The specialist agents, their boundaries and commit identities, and the coordinator/architect-subagent split used by autonomous `auto-*` skills. |
| [Repo Path Threading](architecture/repo-path-threading.md) | How `REPO_PATH`/`repo_path` is resolved once and threaded explicitly through every script call and nested agent spawn. |
| [Shared State & Configuration Files](architecture/shared-state-and-configuration.md) | The `.claude/state/` and `.claude/configuration/` files skills use for queues, per-issue state, and settings, the config tiers, and the key registry (`keys.json`: entry shape, wildcard matching, validation and the specs that keep it in sync). |
| [Branch Bootstrap and Merge Conflicts](architecture/branch-bootstrap-and-merge-conflicts.md) | How issue branches are created/reused and merged up to date with `main`, conflict handling, and safe-branch parking for GitHub-only skills. |
| [Cross-Skill References](architecture/cross-skill-references.md) | How one skill reads another skill's `steps/*.md`/`scripts/*.sh` directly instead of duplicating logic. |
| [Issue Tags](architecture/issue-tags.md) | The canonical tag/GitHub-label mapping, what each tag means, and the shared tag-mutation primitives. |
| [arcanum-create-issue](architecture/arcanum-create-issue.md) | The /arcanum-create-issue contract: draft file lifecycle, the native start/publish commands (output keys and exit codes), and label rules. |
| [Lock System](architecture/lock-system.md) | The lock/mutate/release pattern used to guard concurrent writes to shared JSON state files. |
| [Per-Repo Migrations](architecture/per-repo-migrations.md) | How `arcanum/migrations/` catches a consuming repo up on repo-side structural changes shipped by a later arcanum version. |
| [Script Engine](architecture/script-engine.md) | The shell → Node.js migration for skill entrypoint scripts: the `engine` config key, the dispatch guard, the centralized `core/bin/arcanum` entrypoint, the `core/` package layout, and testing/security conventions. |
| [Shared Lib](architecture/shared-lib.md) | The root `shared/` lib consumed by both `core/` and `cli/`: layout, the import boundary, ownership, packaging and CI, the `RepoConfigWriter` API, and the config services (`ConfigError`, the lock's bounded wait, `RepoPath#toplevel`, `AgentEmail`, the CLI bundle). |
| [Arcanum CLI](architecture/arcanum-cli.md) | The user-facing `arcanum` CLI (`cli/`): its contract (targeting, commands, syntax, value parsing, output and JSON shapes, exit codes, version skew, shortcuts and the setup wizard) and its internals (runtime path, module layout, argument parsing, the refusal order, how reads and writes use the shared config services, and the spec setup). |
| [Docker Engine](architecture/docker-engine.md) | The `engine.mode=docker` design: the runtime image, what is mounted, env and credentials, the docker branch of `engine_dispatch.sh` (resolution order, fallbacks, exit codes) and how it is tested. |
| [Dispatch Permissions](architecture/dispatch-permissions.md) | The audit of specialist-dispatch commands, and the policy for when a routine dispatch gets a `permission_grant.sh` allowlist entry versus relying on the `OUTCOME=blocked` escalation path. |
| [Skill Finish](architecture/skill-finish.md) | How issue skills end: the uniform closing report (`finish_report.sh`), the `/dev/tty` next-step offer for interactive skills (with its exit-`4` `AskUserQuestion` fallback), `Next:` lines for auto skills, and silent nested runs (`NESTED=true`, `FINISH_*` blocks, `--merge`). |
