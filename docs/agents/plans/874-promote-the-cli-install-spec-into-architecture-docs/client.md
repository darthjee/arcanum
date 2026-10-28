# Client Plan: Promote the CLI install spec into architecture docs

Main plan: [plan.md](plan.md)

## Shared contracts

- `architect` creates `docs/agents/architecture/cli-install.md` with `## Shared rules` (`#shared-rules`) and `## Version pinning` (`#version-pinning`). Link to these. Do not restate the installer and updater rules.
- Keep the `## \`self-update\`` heading so `#self-update` stays stable. `architect` links to it.

## Implementation Steps

### Step 1 — Make `arcanum-cli.md`'s `self-update` section the source of truth

In `docs/agents/architecture/arcanum-cli.md`'s `## \`self-update\`` section:

- **Opening sentence:** remove "The [self-update spec](../specs/cli-install/self-update.md) is the source of truth for its messages, outcomes and failures". The section is now the source of truth, both for the contract and for how `cli/lib/commands/selfUpdate.js` implements it.
- **New content from `docs/agents/specs/cli-install/self-update.md`.** Bring in what is still true and missing today. Check each item against `selfUpdate.js` and its specs; the code wins.
  - the decisions: what it runs, the running copy vs the global install, no confirmation;
  - which shared rules it follows or overrides, linking to [CLI Install → Shared rules](cli-install.md#shared-rules);
  - `--help`;
  - the **Outcomes** table and the **Failures** table, with their exact wording;
  - the `--json` shape;
  - edge cases;
  - security and performance;
  - backward compatibility;
  - the alternatives considered. Fold these into the doc's existing `## Alternatives considered`.
- **Existing content:**
  - Keep the existing numbered implementation flow and the npm-output paragraph.
  - Don't duplicate the exit-code table. Exit `8` is already in `## Exit codes`, so only link to it.
- **Spec setup:** if the spec's testing strategy adds anything beyond the existing `## Specs` bullets, fold it into `## Specs`.

When done, `grep -n "specs/cli-install" docs/agents/architecture/arcanum-cli.md` must return nothing.

## Files to Change

- `docs/agents/architecture/arcanum-cli.md` — the `self-update` section, `## Alternatives considered`, and possibly `## Specs`.

## Notes

- Do not edit `cli/lib/commands/selfUpdate.js`'s comment that cites the spec. #875 repoints it.
- Docs only: no CLI behavior change, so `make cli-test` isn't needed. Keep the markdown lint clean.
