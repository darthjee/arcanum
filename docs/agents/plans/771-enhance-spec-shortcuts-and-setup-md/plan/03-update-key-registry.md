# Update key-registry.md

- **`setup` field.** Add an optional `setup` field to the entry shape: `{section, order, prompt, instances?}`. Explain that the wizard asks exactly the entries carrying it, ordered by section, then by `order`. `instances` lists the concrete names for wildcard keys, e.g. `next_step.auto.<skill>` → `enhance-issue`, `discuss-issue`, `auto-plan-issue`. `git.agents.<agent>` is the exception: its instances come from the repo's `.claude/agents/`.
- **`ignored_check_patterns`.** In the seed table, mark `auto-fix-all.ignored_check_patterns` as **repo only**. Its entries are case-insensitive regex strings, validated with `new RegExp(p, 'i')`.
- **Defaults.** Note that registry defaults feed the `default` field of `get` and the shortcuts.
- **Open point.** Add an open point (or a note for #777) that the final registry must include the `setup` field and the `instances` list.

## Files to Change
- `docs/agents/specs/arcanum-cli/key-registry.md` — `setup` field, repo-only regex key, defaults note, #777 dependency.
