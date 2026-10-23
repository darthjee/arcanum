# Issue: arcanum CLI user guide and README install docs

## Description
Part of epic #767 (Arcanum user-facing CLI for configuration). It finishes the end-user documentation of the `arcanum` CLI.

Its dependencies (#780 commands, #781 shortcuts, #782 setup wizard, #783 npm publish) have all merged, and each one already documented itself. `docs/guides/arcanum-cli.md` and `cli/README.md` therefore already cover:
- install (`npm i -g arcanum-cli`) and the three tiers;
- `get`/`set`/`unset`/`list`/`info`, `--force`, `--json` and exit codes;
- targeting (`CLAUDE_CONFIG_DIR`, `--claude-config-dir`, `--repo`);
- the shortcuts and the `setup` wizard.

This issue is now a **gap-filling and consistency pass**, not a from-scratch write.

Owners: `client` for `docs/guides/arcanum-cli.md` and `cli/README.md`; `architect` for the root `README.md` and the other guides.

## Problem
The CLI docs grew one sub-issue at a time and have gaps:
- The root `README.md` never mentions the CLI. Its Configuration section says the `next_step.auto.*` keys can be set only through `/init-claude` or `/arcanum-migrate`.
- `docs/guides/arcanum-global-config.md` and `arcanum-repo-config.md` still describe hand-editing the JSON files, with no pointer to the CLI.
- The user guide's Shortcuts section omits `auto-fix-all finish-on-empty-queue`.
- `cli/README.md`, the npm package page, lists `config setup` only in the command synopsis, with no section explaining it.
- Neither page tells users that releases are published with npm provenance (#783), or how to check it.

## Expected Behavior
- **Root `README.md`:**
  - A short `## Arcanum CLI` section (or a subsection of Configuration) with `npm i -g arcanum-cli`, two or three examples (`arcanum config info`, `arcanum config setup`, one shortcut) and links to `docs/guides/arcanum-cli.md` and `cli/README.md`.
  - The `next_step.auto.<skill>` sentence also names `arcanum config next-step auto <skill> on` and the wizard's `flow` section.
- **`docs/guides/arcanum-global-config.md` and `docs/guides/arcanum-repo-config.md`:** one "From a terminal" pointer each, showing the equivalent `arcanum config` commands (e.g. `arcanum config set <key> <value> --global`, `CLAUDE_CONFIG_DIR=... arcanum config list --global`) and linking to the CLI guide.
- **`docs/guides/arcanum-cli.md`:**
  - Add `auto-fix-all finish-on-empty-queue` to the Shortcuts examples or table.
  - Add a one-line note under Setup that releases carry npm provenance, verifiable with `npm audit signatures`.
  - Re-check every command, shortcut, flag and exit code against `arcanum config --help` and the specs, and fix any drift.
- **`cli/README.md`:**
  - Add a short `### setup` section: what it asks, running a subset of sections, the TTY requirement, and Enter keeps / `-` unsets.
  - Add the same provenance note under Install.
  - Every link stays absolute (`https://github.com/darthjee/arcanum/blob/main/...`), because the page renders on npmjs.com.
- **No behaviour change.** This is documentation only; no code, spec or CI change.

## Solution
- **`client`:** edit `docs/guides/arcanum-cli.md` and `cli/README.md`. Verify against `cli/lib/help.js` and the built CLI (`yarn build && node dist/arcanum.mjs config --help` and the per-shortcut `--help`), and against `docs/agents/specs/arcanum-cli/*.md`.
- **`architect`:** edit the root `README.md`, `docs/guides/arcanum-global-config.md` and `docs/guides/arcanum-repo-config.md`.
- **Checks:** run markdownlint, using the repo's existing config, on the touched files. Check that every relative link resolves.

## Benefits
- Users of the main README discover the CLI, and the global and repo guides point them at the safe, validated way to change settings.
- The npm page explains every command, including the wizard.
- Users can verify the provenance of what they install.
