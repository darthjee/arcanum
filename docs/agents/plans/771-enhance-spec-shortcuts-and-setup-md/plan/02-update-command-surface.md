# Update command-surface.md

Keep the generic layer identical to what the shortcuts reuse:

- **`get` defaults.** Add the additive `"default"` field to `get`'s JSON, and to the unset form of `get --all-tiers`' `resolved` object if that reads naturally. It holds the registry default, or `null`. Add the human `(unset; default: …)` form to the Output examples. Note that the field is additive under the "new fields may be added" rule.
- **Repo-only keys.** Add an exit-`3` row to the error-message examples: `arcanum: auto-fix-all.ignored_check_patterns is repo-only`. Mention under "Keys" that registry tier restrictions can make a key single-tier.
- **Wizard prompts.** In "Output", note that `config setup` writes its prompts to stderr, so stdout stays results-only. The missing-TTY exit `2` is already listed and needs no change.
- **Open point.** Leave the existing `list --json` registry-defaults open point as it is, but cross-reference that `get` now reports `default`.

## Files to Change
- `docs/agents/specs/arcanum-cli/command-surface.md` — `default` field, repo-only example, setup prompt note.
