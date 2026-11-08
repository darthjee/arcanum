# Help and documentation
Document both forms and the new reserved verb.

- `cli/lib/help.js`: extend the `agents email` synopsis to `agents email [<agent>] [--all-tiers] | set <pattern> | set <agent> <email> | unset [<agent>] | edit` with one-line descriptions.
- `cli/README.md`: update the shortcuts table row and the `### agents email` section (matrix example, `edit` example).
- `docs/guides/arcanum-cli.md`: add `--all-tiers` and `edit` to the "Agent emails" examples; note that `edit` needs a terminal and that `set`, `unset` and `edit` are reserved verbs (an agent with one of those names is reachable through `config get/set git.agents.<agent>`).
- `docs/agents/architecture/arcanum-cli.md#agents-email`: describe the matrix (rows, marks, JSON shape from step 01), replace "refuse … `--all-tiers`" with the new rule (accepted on the listing, refused on the detail), describe the editor loop (questions, no lock while prompting, no-TTY error, interrupt behaviour), and add `edit` to the reserved-verbs sentence.

## Files to Change
- `cli/lib/help.js` — synopsis and descriptions.
- `cli/README.md` — shortcuts table and `agents email` section.
- `docs/guides/arcanum-cli.md` — user guide examples and notes.
- `docs/agents/architecture/arcanum-cli.md` — `### agents email` architecture section.
