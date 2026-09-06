# Issue: Add layering-boundary lint guardrail to core/eslint config

## Description
Part of #391 (stretch item). Enforce the documented one-way layering direction in `core/lib/` — `commands → context/services → utils` — via lint, rather than by convention only.

## Investigation findings
- `docs/agents/architecture/script-engine.md` documents `core/lib/`'s one-way dependency direction (`commands` → `context`/`services` → `utils`) as enforced "by convention (no lint rule)".
- Nothing today stops a module under `context/`, `services/`, or `utils/` from importing back from `commands/`.
- This is a distinct rule/tooling concern from the plain circular-import check (tracked separately), since it requires an import-boundary rule rather than a cycle detector.
- **A real, pre-existing violation already exists**: `context/RepoContext.js` imports `GithubIssue` from `commands/shared/GithubIssue.js` (`commands/shared/GithubIssue.js` is a genuine `commands/` module — it's registered as the `github-issue-fetch`/`github-issue-create` dispatch-table entries in `core/commands.js`). `RepoContext` default-constructs a `GithubIssue` and exposes it via `RepoContext#createIssue`, which `commands/shared/SpawnIssue.js` calls. Turning the boundary rule on as originally scoped would fail lint immediately on this real import, not just on a throwaway test import — so fixing it is part of this issue's scope (see Solution).

## Solution
- Fix the pre-existing violation first: extract the "create a GitHub issue" logic that both `commands/shared/GithubIssue.js` (the CLI entrypoint) and `RepoContext` need into a new `services/` class (e.g. `services/GithubIssueService.js`). `commands/shared/GithubIssue.js` and `context/RepoContext.js` both depend on the new service instead — matching the documented `commands → services` and `context → services` allowed directions, with no lint exception required.
- Add a hand-rolled `no-restricted-imports` boundary rule to `core/eslint.config.mjs` — no new devDependency: an override for files under `lib/context/`, `lib/services/`, and `lib/utils/` with `no-restricted-imports` `patterns` blocking import specifiers matching `**/commands/**`.
- Update `docs/agents/architecture/script-engine.md` to note the layering rule is now lint-enforced, not just convention.

## Done when
- [ ] `context/RepoContext.js` no longer imports anything from `commands/` — the shared GitHub-issue-creation logic lives in a `services/` class used by both `RepoContext` and `commands/shared/GithubIssue.js`
- [ ] `core/`'s ESLint config fails on a `commands/` ← `context`/`services`/`utils` reverse-layering violation (verify with a throwaway violating import, then remove it)
- [ ] `core/`'s ESLint config passes cleanly on the current (post-fix) codebase
- [ ] `docs/agents/architecture/script-engine.md` updated to note the rule is lint-enforced
