# next-step auto
Implement `config next-step auto [<skill> [on|off | --unset]]` (spec "Design rules", "Output").

- With `<skill>`: a boolean single-value shortcut over `next_step.auto.<skill>`, using step 01's runner (default tier local). Any well-formed skill name is accepted, per the registry's wildcard matching.
- Without `<skill>`: list every resolved `next_step.auto.*` key that is set, one line per key in the form `<skill>  <true|false>  (<tier>)`, sorted by skill. Always exit `0`, including for an empty list. JSON: `{"entries": [{"key", "value", "source"}]}`.

## Files to Change
- `cli/lib/commands/config/shortcuts/nextStep.js` (new) — the listing and per-skill forms.
- `cli/spec/lib/commands/config/shortcuts/nextStep_spec.js` (new) — empty list, mixed tiers, a `false` shadowing a `true`, and the per-skill forms against their generic equivalents.
