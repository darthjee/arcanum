# Scaffold both entries

Run `arcanum/migrations/generate_next.sh --type script`, then
`arcanum/migrations/generate_next.sh --type instructions`. Record the printed ids (expected `001`,
`002`). In `arcanum/migrations/repos/next/migrations.json`, change `applies_to` from `"local"` to
`"repo"` on both new entries: they change committed files, and the committed repo pointer means
other clones see them as satisfied once one contributor runs and commits them.

## Files to Change
- `arcanum/migrations/repos/next/migrations.json` — two new entries, `applies_to: "repo"`.
- `arcanum/migrations/repos/next/001.sh`, `001.md`, `002.md`, `002.instructions.md` — skeletons (filled in by steps 02–03).
