# Plan: arcanum CLI user guide and README install docs

Issue: [784-arcanum-cli-user-guide-and-readme-install-docs.md](../../issues/784-arcanum-cli-user-guide-and-readme-install-docs.md)

## Overview
A documentation-only pass that fills the gaps left after #780–#783 each documented their own part of the CLI.
- `client` finishes `docs/guides/arcanum-cli.md` and `cli/README.md`.
- `architect`, as coordinator, edits the root `README.md` and the two config guides directly.

See [client.md](client.md) for the `client` work.

## Architect work (done by the coordinator, not dispatched)
- **`README.md`:**
  - Add a `## Arcanum CLI` section after `## Configuration`'s intro, or as its first subsection, with:
    - `npm i -g arcanum-cli` and its Node ≥ 22.13.0 requirement;
    - three examples: `arcanum config info`, `arcanum config setup` and `arcanum config engine native`;
    - links to [`docs/guides/arcanum-cli.md`](../../../guides/arcanum-cli.md) and [`cli/README.md`](../../../../cli/README.md).
  - Extend the `next_step.auto.<skill>` sentence ("can be set through `/init-claude` … or `/arcanum-migrate` …") with "or from a terminal with `arcanum config next-step auto <skill> on` (or the `arcanum config setup flow` wizard)".
- **`docs/guides/arcanum-global-config.md`:** add a `## From a terminal` section with `arcanum config list --global`, `arcanum config set <key> <value> --global` and `CLAUDE_CONFIG_DIR=~/.claude-work arcanum config list --global` (with an unquoted `~`), linking to `arcanum-cli.md`.
- **`docs/guides/arcanum-repo-config.md`:** add a similar short pointer, `arcanum config set <key> <value> --repo` / `--local`, plus a note that the CLI writes only the new files and never the legacy ones. Link to `arcanum-cli.md`.
