# Node Plan: Create-issue: Epic label

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md) "Shared contracts" — this agent owns the native side of the default label, the tag table and `markSplit`, plus the Jasmine spec for the shell migrations.

## Implementation Steps

### Step 1 — Native default, tag table, `markSplit`, and their specs

- `core/lib/services/LabelConfig.js`: append `'Epic:fbca04'` to `DEFAULT_LABEL_PAIRS`; update `LabelConfig_spec.js` and any init-claude label specs (e.g. `InitClaudeSyncLabels_spec.js`, `initClaudeLabelsEngineDispatch_spec.js`) that enumerate the defaults.
- `core/lib/utils/issue/Tags.js`: add `Epic: 'epic'` to `LABEL_TO_TAG`; leave `ACTIONABLE_TAGS` unchanged. `Tags_spec.js`: `Epic` maps to `epic`, and `actionableTags(['Epic'])` is empty.
- `LabelApplicator_spec.js`: a parent carrying `Epic` (plus a non-pipeline label like `Bug`) does not pass `Epic` on. Add/extend spawn-issue parity coverage (`core/spec/bin/`) so shell and native both drop `Epic`.
- `core/lib/commands/shared/GithubIssueMark.js`: change `MARK_TRANSITIONS.split` so `markSplit` adds `split`, then `epic`, then removes `planning` (e.g. generalize `add` to an `adds` array for all transitions, keeping the others' behavior identical). Update `GithubIssueMark_spec.js`, `core/spec/bin/githubIssueMarkParity/split_spec.js` and `arcanumSplitIssueFinishParity_spec.js` / `ArcanumSplitIssueFinish_spec.js` where they assert the mutations.

### Step 2 — Migration spec

- New `core/spec/bin/` Jasmine spec (e.g. `migrationsNextEpicLabel_spec.js`) that runs `arcanum/migrations/repos/next/001.sh run` and `002.sh run` in a temp git repo with a stubbed `gh` on `PATH` (follow existing stubbed-`gh` patterns in `core/spec/bin/`). Cover:
  - `001`: label missing -> `gh label create Epic ... --color fbca04` called; label present as `Epic` or `epic` -> no create/edit, `already present` message; re-run is idempotent.
  - `002`: config missing -> skipped; config present without `Epic` -> entry `Epic`/`fbca04` added; config already has `Epic` -> unchanged; re-run is idempotent.
  - `config` subcommand prints `{"skippable": true}` for both.
- Run `make core-check`; keep jscpd clean and coverage at the current threshold.

## Files to Change

- `core/lib/services/LabelConfig.js`, `core/lib/utils/issue/Tags.js`, `core/lib/commands/shared/GithubIssueMark.js`
- `core/spec/lib/services/LabelConfig_spec.js`, `core/spec/lib/utils/issue/Tags_spec.js`, `core/spec/lib/utils/issue/LabelApplicator_spec.js`, `core/spec/lib/commands/shared/GithubIssueMark_spec.js`, `core/spec/lib/commands/init-claude/InitClaudeSyncLabels_spec.js` (if it enumerates defaults)
- `core/spec/bin/githubIssueMarkParity/split_spec.js`, `core/spec/bin/arcanumSplitIssueFinishParity_spec.js` (if affected), spawn-issue parity spec
- New `core/spec/bin/<migrations epic>_spec.js`

## CI Checks

- `core/`: `make core-check` (CI jobs: `yarn test`, `yarn lint`)

## Notes

- Step 2 depends on scripter's Step 2 (the migration scripts must exist).
