# Add a genuine carve-out to line 36

Reword to allow trivial, low-misinterpretation-risk logic to stay inline, referencing the existing guideline in [Script Preference](../../../architecture/script-preference.md):

- **Line 36**: reword to something like `Never embed deterministic logic in skill markdown, unless it is trivial enough that AI misinterpretation risk is negligible (see` `Script Preference` `'s guideline) — otherwise extract it into` `<skill>/scripts/*.sh` `or` `arcanum/_lib/`.

## Files to Change

- `AGENTS.md` — reword line 36 as above.
