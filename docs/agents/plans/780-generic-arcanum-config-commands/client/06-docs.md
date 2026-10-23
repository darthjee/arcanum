# Help, README, architecture doc and user guide
Document the finished commands.

- `help.js`: per-subcommand usage text for `config <sub> --help`, and remove the "not implemented yet" wording.
- `cli/README.md`: the command reference, with examples for each subcommand, the exit-code table and the targeting flags.
- An architecture doc for the CLI's internals (module layout from steps 01–05, the precedence order, and how shared services are used), with a row in the `docs/agents/architecture.md` hub table.
- The end-user guide `docs/guides/arcanum-cli.md`: setup, everyday get/set/unset/list/info use, `--json` for scripts, and the troubleshooting exits `5`/`6`/`7`.

## Files to Change
- `cli/lib/help.js`, `cli/spec/lib/help_spec.js` — subcommand help.
- `cli/README.md` — the command reference.
- `docs/agents/architecture/arcanum-cli.md` (new) — CLI internals.
- `docs/agents/architecture.md` — a hub row for it.
- `docs/guides/arcanum-cli.md` (new) — the end-user guide.
