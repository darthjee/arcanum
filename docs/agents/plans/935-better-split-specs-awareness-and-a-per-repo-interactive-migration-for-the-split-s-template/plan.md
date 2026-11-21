# Plan: Split specs awareness: Specs concern in the split checklist and a per-repo migration to add it

Issue: [935-better-split-specs-awareness-and-a-per-repo-interactive-migration-for-the-split-s-template.md](../../issues/935-better-split-specs-awareness-and-a-per-repo-interactive-migration-for-the-split-s-template.md)

## Overview

`/arcanum-split-issue` becomes specs-aware in two ways. A new **Specs** concern is appended to the default split checklist that `/init-claude` seeds, in both engines. The split's explore and discuss steps also consult `docs/agents/specs.md`. A new skippable, repo-scoped `instructions` migration, `arcanum/migrations/repos/next/003.instructions.md`, adds the same bullet to existing repos' `docs/agents/arcanum-split-issue.md`. Three specs lock the seed content, the manifest entry, and the match between the migration's quoted bullet and the seed.

## Agents involved

- [scripter](scripter.md): shell seed and the `next/003` migration entry.
- [node](node.md): native seed and all specs.
- [skill-writer](skill-writer.md): `arcanum-split-issue/steps/explore.md` and `steps/discuss.md`.

## Shared contracts

**The Specs bullet.** It must be byte-identical in all three places: the shell seed, the native `SPLIT_ISSUE_CONTENT`, and the fenced block in `003.instructions.md`. It is a single line, appended as the **last** bullet after `**Responsible agents**`:

```markdown
- **Specs** — does any part of this work need a design agreed in `docs/agents/specs/` first (worth its own "write the spec" sub-issue), and do existing specs listed in `docs/agents/specs.md` constrain how the sub-issues are shaped?
```

**The migration entry.** `arcanum/migrations/repos/next/migrations.json` gains, after `002`:

```json
{
  "id": "003",
  "type": "instructions",
  "description_file": "003.md",
  "instructions_file": "003.instructions.md",
  "skippable": true,
  "applies_to": "repo"
}
```

`generate_next.sh --type instructions` scaffolds it with `applies_to: "local"`, which must be changed to `"repo"`.

**How the drift guard finds the bullet.** `003.instructions.md` contains the bullet as the **only** line starting with `- **Specs** —` inside a fenced `markdown` code block. The node spec extracts that line and asserts the seeded `docs/agents/arcanum-split-issue.md` contains it verbatim.

## Notes

- The issue lists `architect` as owner of the `next/003` files. Because the coordinator is excluded from the plan split, that work goes to `scripter`, who also owns the matching shell seed. The architect still reviews the instructions wording.
- No change to `init-claude/setup_arcanum_split_issue.md`: it already preserves the bullet-list shape when rewriting.
