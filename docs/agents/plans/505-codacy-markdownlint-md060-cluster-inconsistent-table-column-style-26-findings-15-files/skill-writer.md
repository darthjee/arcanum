# skill-writer Plan: Codacy: markdownlint MD060 cluster — inconsistent table column style (26 findings, 15 files)

Main plan: [plan.md](plan.md)

## Shared contracts

Reformat every table below to `compact` style: single space of padding around each cell's content, delimiter row not stretched to match column width. Do not change cell content, add/remove columns, or reorder rows. `architect` pins this same style in `.markdownlint.json`'s `MD060.style` key; nothing further to coordinate.

## Implementation Steps

### Step 1 — Reformat the 4 skill files' tables to `compact` style

For each file below, reformat the table at the given line to `compact` style (single space around cell content; delimiter row not padded to column width).

## Files to Change

- `auto-fix-issue/steps/run.md:22` — 1 table to reformat.
- `init-claude/SKILL.md:27` — the scenario-mapping table (currently fully space-padded `aligned` style — the outlier for this whole cluster); de-pad every cell down to a single space and shrink the delimiter row to match.
- `init-claude/sample-contributing.md:74` — 1 table to reformat.
- `init-claude/setup_auto_fix_all_settings.md:22` — 1 table to reformat.

## Notes

- `init-claude/SKILL.md`'s table alone accounts for 8 of this cluster's 26 findings (one per misaligned row) — it's the only table in the whole cluster using `aligned` rather than something already close to `compact`, so double-check the reformatted result renders correctly (same column count and order, just no padding).
