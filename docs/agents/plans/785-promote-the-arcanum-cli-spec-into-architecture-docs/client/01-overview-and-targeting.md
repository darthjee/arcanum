# Overview, targeting and the cross-cutting contract

Rewrite the intro, rename the title (e.g. "Arcanum CLI") and add the sections the spec index defines. The doc then stands on its own:

- **Intro.** Say what the CLI is (the optional npm package `arcanum-cli`, `arcanum config ...`), what it reads and writes (the three tiers, with the same rules and the same lock as the skills), and who owns it. Keep the links to the end-user guide and `cli/README.md`. Drop "the contract … is the spec; this doc does not repeat it".
- **Goal and distribution.** Optional, installed separately (`npm i -g arcanum-cli`), one install per machine for every Arcanum install and Claude account. Link to [Install & Release → npm package](install-and-release.md#npm-package-arcanum-cli) for publishing.
- **Relationship to `core/bin/arcanum`.** The internal dispatcher is never on `PATH`; `cli/` imports nothing from `core/`.
- **Targeting.** `CLAUDE_CONFIG_DIR` (used as is), `--claude-config-dir` (wins, expands `~`), and `--repo <path>` (subdirectories and worktrees normalize to the repo root via `RepoPath#toplevel`; check `cli/lib/target.js`). The CLI never creates a missing Claude config dir and refuses repo/local writes in a repo that hasn't run `/init-claude`.
- **`config info`.** What it prints, from `cli/lib/commands/config/info.js`.
- **Version skew.** The embedded migration-version list (link to Install & Release for how it is built), "file ahead" means exit `5` (bypassable with `--force`), and "file behind" means a hint to run `/arcanum-migrate`, per `cli/lib/skew.js`.
- **Runtime.** The Node floor (22.13.0, in lockstep with `core/`'s `engines.node`), checked by `cli/bin/arcanum`. Merge this with the existing "Runtime path" section rather than duplicating it.
- **Exit codes.** The full table from `cli/lib/exitCodes.js`, with the error code names used in JSON errors.

## Files to Change
- `docs/agents/architecture/arcanum-cli.md` — new title and intro; new Goal and distribution, Relationship to `core/bin/arcanum`, Targeting, `config info`, Version skew and Exit codes sections; Runtime merged into Runtime path.
