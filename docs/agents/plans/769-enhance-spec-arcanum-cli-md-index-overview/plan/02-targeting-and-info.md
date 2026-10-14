# Targeting and `config info`

Extend the index's "Targeting" section and add the `info` fields, using the issue's "Repo targeting…", "Account targeting edge cases" and "`arcanum config info` fields" decisions.

**Account (global tier):**

- Fix the `~` wording: only `--claude-config-dir` is expanded (`~` and `~/...`; `~user` is a usage error; relative paths resolve against cwd to an absolute path). `CLAUDE_CONFIG_DIR` is used **verbatim**, like `ConfigChain`, the shell helpers and Claude Code; a value starting with `~` triggers a "not expanded" warning. Empty value = unset.
- Add the edge-case table: unresolved (no flag, env or `$HOME`); directory missing (reads empty + warning, writes refused, never created); path is a file (error); directory without `arcanum-config.json` (created on first write); directory without an arcanum install (not checked).

**Repo (repo and local tiers):**

- cwd and `--repo` normalize to `git rev-parse --show-toplevel` (subdirectory → root; worktree → its own root). A non-existent / non-directory `--repo` is a usage error (reusing `RepoPath`'s messages). No `git` on PATH → "no repo" with a warning.
- Add the three-state table: no repo (`get`/`list` without tier fall back to global with a stderr note; explicit `--repo`/`--local` error); git repo not configured (`.claude/configuration/arcanum-repo-config.json` missing — reads empty, writes refused hinting at `/init-claude`, no `--force` override); configured (normal; local file created on first write).
- Errors use "target unavailable".

**`arcanum config info` (new subsection, or under Targeting):**

- Purpose: describe the environment, never config values.
- Fields: CLI (version, running Node, required floor); Account (dir + source `flag`/`env`/`default`/`unresolved`, global file path/existence/pointer/skew status); Repo (root + source `flag`/`cwd`, repo and local file path/existence/pointer/skew status).
- Skew status: `up to date` / `behind (N pending)` (count) / `ahead (writes refused without --force)`.
- Include the human-output example from the issue.
- `--json`: `cli`/`account`/`repo` blocks, `repo: null` when none (shape detailed in Command Surface). Always exits 0 except on usage errors; read-only, no locks.

## Files to Change

- `docs/agents/specs/arcanum-cli.md` — "Targeting" section extended (account edge cases, repo states, normalization); new `config info` subsection.
