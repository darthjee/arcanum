# Create-issue: Epic label

## Context

Part of epic #687 (new skill `/arcanum-create-issue` + `Epic` label). Blocked by **Create-issue: spec** (#688), whose issue body records the agreed decisions this sub-issue implements (sections "Epic and split-issue", "Migration" and "Testing strategy").

There is no label for issues that are created only to be split later. Worse, when #687 itself was split, its `Epic` label was copied onto every sub-issue (#688–#693) and had to be removed by hand, because label carryover only strips known pipeline tags.

This sub-issue adds the `Epic` label (color `fbca04`) as an init-claude default, ships migrations that provision it on existing repos/clones, registers it as a non-actionable pipeline tag so it is never carried over to sub-issues or spawned issues, and makes `arcanum-split-issue` keep (or add) `Epic` on the split parent.

## What needs to be done

### Default label

- Add `Epic:fbca04` to `DEFAULT_LABEL_PAIRS` in `init-claude/scripts/lib/label_config.sh` and in its native counterpart `core/lib/services/LabelConfig.js`.

### Migrations (`arcanum/migrations/repos/next/`)

Two entries in `migrations.json`, both `type: "script"`, `skippable: true`, no prompt, idempotent, each with its own `NNN.sh` and `NNN.md` description. Modeled on `arcanum/migrations/repos/0.17.2/001` (`Spawned` label).

| id | `applies_to` | Behavior |
| --- | --- | --- |
| `001` | `repo` | Creates `Epic:fbca04` on the repo's GitHub labels **only if it is missing** (case-insensitive name match). An existing `Epic` label is left as is, keeping its own color; logs `already present`. |
| `002` | `local` | If `.claude/state/init-claude-config.json` exists and has no `Epic` entry, adds `Epic:fbca04` via `init-claude/scripts/write_label_config.sh add`. An existing entry is left alone; a missing file is skipped. |

Two entries are needed because `.claude/state/` is git-ignored: a config update inside a `repo`-scoped entry would only reach the clone that runs it.

### `Epic` as a non-actionable pipeline tag

- Register `Epic → epic` as a **non-actionable** pipeline tag in `core/lib/utils/issue/Tags.js` and `arcanum/_lib/tags.sh`.
- As a result, label carryover (`LabelApplicator.js` native / `spawn_issue_shell.sh` shell) stops copying `Epic` onto sub-issues and spawned issues, and `monitor-issues` sees `epic` among its parsed tags.

### Split parent keeps `Epic`

- In `arcanum-split-issue`'s finish step, the parent keeps `Epic`, and gets it added if missing, next to the existing `Planning → Split` swap. A split parent is a tracking issue and must never be implemented.
- Shell and native change together; regenerate the tag-mutations table (`docs/agents/tag-mutations.md`).

### Tests

- `LabelConfig_spec.js` and the init-claude label specs include `Epic:fbca04`.
- `Tags_spec.js` maps `Epic` to `epic` and treats it as non-actionable.
- `LabelApplicator_spec.js` and spawn-issue parity verify `Epic` is not copied.
- Split-finish parity covers adding `Epic` to the parent.
- Tag-mutations table regenerated (`scripts/test_generate_tags_table.sh` passes).
- A `core/spec/bin` Jasmine spec runs migrations `001.sh` and `002.sh` with a stubbed `gh` on `PATH` and a temp repo, covering: label missing (created), label present in any case (left alone), config present/missing, `Epic` already in config, and re-running (idempotent).

## Acceptance criteria

- [ ] `Epic:fbca04` is in init-claude's default labels (shell and native)
- [ ] Migration `001` (`repo`) creates `Epic:fbca04` only if missing and is safe to re-run
- [ ] Migration `002` (`local`) adds `Epic` to `init-claude-config.json` when the file exists and lacks it, and is safe to re-run
- [ ] Specs/tests cover the new default and both migrations
- [ ] `Epic` is a non-actionable pipeline tag and is not copied to sub-issues or spawned issues
- [ ] A split parent keeps `Epic`, or gets it added; the tag-mutations table is regenerated
- [ ] `make core-check` and jscpd stay clean
