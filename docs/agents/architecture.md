# Architecture

This is a hub into arcanum's internals, split by topic into `docs/agents/architecture/*.md`. Start with whichever file below matches what you need — each one reads standalone.

| File | Covers |
|------|--------|
| [Overview and Source Code Layout](architecture/overview-and-layout.md) | What this repo is (a set of markdown-driven skills, no runtime), and how a skill folder is laid out. |
| [Install & Release Pipeline](architecture/install-and-release.md) | The `curl \| bash` bootstrap/installer two-stage install flow, the release zip, and the `update` flow that brings an existing install current. |
| [Script Preference](architecture/script-preference.md) | Why deterministic logic belongs in `<skill>/scripts/`, not in markdown prose. |
| [Agent Roster and Architect Delegation](architecture/agent-roster-and-delegation.md) | The specialist agents (`scripter`, `skill-reviewer`) and the coordinator/architect-subagent split used by autonomous `auto-*` skills. |
| [Repo Path Threading](architecture/repo-path-threading.md) | How `REPO_PATH`/`repo_path` is resolved once and threaded explicitly through every script call and nested agent spawn. |
| [Shared State & Configuration Files](architecture/shared-state-and-configuration.md) | The `.claude/state/` and `.claude/configuration/` files skills use for queues, per-issue state, and settings. |
| [Branch Bootstrap and Merge Conflicts](architecture/branch-bootstrap-and-merge-conflicts.md) | How issue branches are created/reused and merged up to date with `main`, conflict handling, and safe-branch parking for GitHub-only skills. |
| [Cross-Skill References](architecture/cross-skill-references.md) | How one skill reads another skill's `steps/*.md`/`scripts/*.sh` directly instead of duplicating logic. |
| [Issue Tags](architecture/issue-tags.md) | The canonical tag/GitHub-label mapping, what each tag means, and the shared tag-mutation primitives. |
| [Lock System](architecture/lock-system.md) | The lock/mutate/release pattern used to guard concurrent writes to shared JSON state files. |
| [Per-Repo Migrations](architecture/per-repo-migrations.md) | How `arcanum/migrations/` catches a consuming repo up on repo-side structural changes shipped by a later arcanum version. |
| [Script Engine](architecture/script-engine.md) | The shell → Node.js migration for skill entrypoint scripts: the `engine` config key, the dispatch guard, the centralized `core/bin/arcanum` entrypoint, the `core/` package layout, and testing/security conventions. |
| [Dispatch Permissions](architecture/dispatch-permissions.md) | The audit of specialist-dispatch commands, and the policy for when a routine dispatch gets a `permission_grant.sh` allowlist entry versus relying on the `OUTCOME=blocked` escalation path. |
