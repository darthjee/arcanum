# Rewrite the AGENTS.md bullets

**Boundaries bullet** (currently line 42): replace it with a bullet that states the threshold inline and links to the full criteria, e.g.:

> - **Never embed deterministic logic in skill markdown beyond a single command (optionally one `&&`/`||` chain), a call to an existing script, or reading/printing a variable.** Extract anything with loops, conditionals, multi-stage parsing pipelines, data-manipulating heredocs or process substitution, or intermediate validation/parsing variables into `<skill>/scripts/*.sh` or `arcanum/_lib/`. See [Script Preference](docs/agents/architecture/script-preference.md#allowed-inline-vs-must-extract) for the full criteria.

**Conventions bullet** (currently line 21, "Whenever possible, extract skill logic into scripts…"): replace it with wording tied to the same threshold, e.g.:

> - Extract any skill logic beyond the inline threshold in [Script Preference](docs/agents/architecture/script-preference.md#allowed-inline-vs-must-extract) into scripts, to make behavior deterministic and reduce token consumption.

Check that the anchor matches the heading added in step 01.

## Files to Change

- `AGENTS.md` — rewrite the Boundaries "deterministic logic" bullet and the Conventions "Whenever possible" bullet.
