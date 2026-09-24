# Unit, parity and routing specs

**Unit specs**, mirroring `core/lib/` 1:1:
- `core/spec/lib/services/LabelConfig_spec.js`: every function, and the malformed-JSON and empty-array cases.
- `core/spec/lib/utils/github/GitHubLabelClient_spec.js`: pagination across more than 100 labels via `fakeFetch`, URL-encoding of `Ready for Work`, and failures.
- `core/spec/lib/commands/init-claude/InitClaudeWriteLabelConfig_spec.js` and `InitClaudeSyncLabels_spec.js`:
  - yes, no, and invalid-then-yes answers.
  - Whitespace-padded `" Y "`.
  - EOF with no input, and an unterminated final line.
  - Case-insensitive update (`bug` → `Bug`).
  - Invalid config pair.
  - Non-git repo_path answered "n" still printing the table.

**Test support:**
- `runCommand` gains an optional `input` string, piped to the child's stdin.
- `fakeGhBin.js` gains `gh label list -R <ref> [--limit N] --json name -q '.[].name'` (prints `$FAKE_GH_REPO_LABELS`, newline-separated), plus `gh label create`/`gh label edit`, which succeed.
- `fakeGithubApiFetchPreload.js` gains a `labels` mode serving `$FAKE_FETCH_REPO_LABELS`, paginated, with POST/PATCH returning 201/200.
- Extend `core/spec/support/utils/initClaudeParity.js` as needed for stdin.

**Parity specs:** run the `*_shell.sh` directly against `core/bin/arcanum` with the fake-fetch preload. Use `expectParity` on stdout and exit code, plus a stderr equality check wherever neither side involves `gh`.
- `core/spec/bin/initClaudeWriteLabelConfigParity/{replace,remove,add}_spec.js`: success cases (byte-compare the resulting config files), invalid pair / `:` name, and a missing config for remove/add.
- `core/spec/bin/initClaudeSyncLabelsParity_spec.js`: yes (mixed create and update), no, EOF, invalid-then-yes, invalid config pair, and a missing config that triggers defaults.
- `core/spec/bin/initClaudeLabelsEngineDispatch_spec.js`: `itRoutesEngineDispatch` through the real shims for all four command names under `engine.mode=native`/`shell`. Also cover the shim-level usage errors and that a relative `<config_path>` lands under the shim's cwd in both modes.

## Files to Change
- `core/spec/lib/services/LabelConfig_spec.js` — new
- `core/spec/lib/utils/github/GitHubLabelClient_spec.js` — new
- `core/spec/lib/commands/init-claude/InitClaudeWriteLabelConfig_spec.js` — new
- `core/spec/lib/commands/init-claude/InitClaudeSyncLabels_spec.js` — new
- `core/spec/bin/initClaudeWriteLabelConfigParity/*_spec.js` — new
- `core/spec/bin/initClaudeSyncLabelsParity_spec.js` — new
- `core/spec/bin/initClaudeLabelsEngineDispatch_spec.js` — new
- `core/spec/support/utils/runCommand.js`, `fakeGhBin.js`, `fakeGithubApiFetchPreload.js`, `initClaudeParity.js` — stdin + label fakes
