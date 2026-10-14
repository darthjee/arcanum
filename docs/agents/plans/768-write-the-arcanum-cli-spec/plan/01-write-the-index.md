# Write the index / overview

Create `docs/agents/specs/arcanum-cli.md`, following the shape of `docs/agents/specs/shell-engine-removal.md`.

Sections:

- **Title** `# Spec: Arcanum CLI`.
- **Status** — `Proposed`. Nothing implemented yet.
- **Origin** — one line: `Origin: epic #767 (design discussion); this spec supersedes the epic body.`
- **Goal** — an `arcanum` command, runnable outside Claude Code, to manage arcanum configuration across the global (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`), repo (`.claude/configuration/arcanum-repo-config.json`) and local (`.claude/state/arcanum-config.json`) tiers. Non-goals: anything other than configuration for now (the top-level namespace is kept free for future features); installing or updating arcanum itself.
- **Distribution** — optional, installed separately via npm (`npm i -g arcanum-cli`), command `arcanum`; one machine-wide client serves every arcanum install and Claude account (rationale: users with several installs must not get competing clients). No per-repo migration installs or nudges it. Runs on the host's Node.js, no Docker fallback.
- **Relationship to `core/bin/arcanum`** — the internal dispatcher stays untouched (no rename, no change to `engine_dispatch.sh`, Docker image or `migration-status.json`); it is never on PATH, so there's no name collision. The CLI is a separate entrypoint in a new root folder `cli/`.
- **Ownership** — new specialist agent `client` owns `cli/`, created before any CLI code; `infra` gains `.circleci/`. Summarize the scope split (client / node / infra / architect) from #767's "The `client` agent" section.
- **Targeting** — account: `CLAUDE_CONFIG_DIR` env honoured (e.g. `CLAUDE_CONFIG_DIR=~/.claude-favini arcanum config ...`), `--claude-config-dir` overrides it, leading `~` expanded by the CLI, default `$HOME/.claude`, `arcanum config info` shows the resolved dir and its source. Repo: cwd by default, `--repo <path>`.
- **Version skew** — one CLI may face repos on different arcanum versions; read the repo's recorded `.version`, warn (or refuse writes) when the config shape is newer than understood.
- **Parts** — a list linking the five parts with one line each.
- **Alternatives considered** — renaming `core/bin/arcanum` to free the name (touches engine/Docker/old installs); one binary serving both internal and user commands under an `internal` namespace (mixes argv conventions, exposes internal commands); shipping the CLI inside each arcanum install (several competing clients for multi-install users).
- **Open points** — e.g. exact version-skew behaviour (warn vs refuse), minimum supported Node version, `config info` output fields.
- **See also** — `../architecture/shared-state-and-configuration.md`, `../architecture/script-engine.md`, `../architecture/install-and-release.md`, `../architecture/agent-roster-and-delegation.md`, `../../guides/arcanum-global-config.md`.

## Files to Change
- `docs/agents/specs/arcanum-cli.md` — new index/overview file.
