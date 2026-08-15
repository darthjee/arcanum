# Global cross-project local arcanum config

## Context

Arcanum already has two config layers, both scoped to a single repo:

- `.claude/configuration/arcanum-repo-config.json` — committed, shared, repo-wide config.
- `.claude/state/arcanum-config.json` — gitignored, per-checkout local state (e.g. `git.safe_branch`, and soon `git.email` per issue #156).

Neither layer survives outside the repo it lives in. A user working across many projects on the same machine — or the same account across machines, if synced — currently has no way to set a personal default that arcanum picks up automatically in every repo, without re-configuring `.claude/state/arcanum-config.json` per clone.

This was raised as a related but explicitly out-of-scope idea while discussing issue #156 (Improve commit template): #156 defines `git.email` as a per-agent template (e.g. `darthjee+{agent}@gmail.com`) resolved through a local-then-repo fallback chain. A natural next step is a third, outermost fallback — a global, cross-project, cross-machine (if the user syncs their home directory / dotfiles) local config, read only when neither the repo's local state nor its repo config has a value. This issue tracks that idea as its own follow-up, deliberately kept out of #156's scope.

## What needs to be done

- Design a global config file location outside any git repo (e.g. under the user's home directory, such as `~/.claude/arcanum-config.json` or similar — exact path and format need deciding) that is never part of a project's own git history and is shared across every repo the user runs arcanum in.
- Define how this global config fits into the existing config-resolution chain (e.g. extend `arcanum/_lib/repo_config.sh`'s lookup helper, or add a new dedicated reader) — likely as the last fallback, after a repo's local state (`.claude/state/arcanum-config.json`) and repo config (`.claude/configuration/arcanum-repo-config.json`), so per-repo config always wins when present.
- Decide which keys are meaningful at this scope. The motivating example is a user-level default `git.email` pattern (so a user doesn't have to re-answer the same migration prompt in every repo they work in), but the design should account for other cross-project, per-user defaults that may come up later.
- Document the new config layer in `docs/agents/architecture.md` and `docs/agents/folder-structure.md`, alongside the existing two config files, making the full resolution order (local repo state -> repo config -> global user config -> hardcoded default) explicit.
- Consider how this interacts with the migration system (`arcanum/migrations/`): should a migration be able to seed/read the global file, given migrations are currently modeled as per-repo, not per-user?

## Acceptance criteria

- [ ] TODO
