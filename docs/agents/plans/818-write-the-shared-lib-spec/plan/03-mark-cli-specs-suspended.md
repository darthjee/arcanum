# Mark the reversed arcanum-cli spec sections as suspended

Add a one-line banner at the top of each section below. Change nothing else in these files: the rewrite is #826's job. Plain `core/lib/...` path mentions elsewhere (e.g. in `command-surface.md`) get no banner.

The banner text, with the link adjusted per file (`../shared-lib.md` from `arcanum-cli/*.md`, `shared-lib.md` from `arcanum-cli.md`):

> **Suspended:** under revision by epic #816; see [Shared Lib](../shared-lib.md). Until #826 rewrites it, `shared-lib.md` wins where the two disagree.

| File | Section |
| --- | --- |
| `docs/agents/specs/arcanum-cli/shared-config-logic.md` | "Source stays in `core/`" |
| same | "Bundle at build time with `esbuild`": the banner is scoped to the "Build-time surface check" paragraph only |
| same | "Shared-surface lint rule" (under "Guardrails") |
| same | "Future work" |
| same | "Alternatives considered": a banner on the "Extracting a shared workspace package now" bullet only |
| `docs/agents/specs/arcanum-cli.md` | "Ownership": a banner on the `node` row only |
| `docs/agents/specs/arcanum-cli/key-registry.md` | "Location" |
| `docs/agents/specs/arcanum-cli/packaging-and-release.md` | "Build output": a banner on the "shared config surface from `core/lib`" bullet only |

For scoped banners (a paragraph, a bullet or a table row), put the banner directly above that element. For a table row, put it directly below the table instead, naming the row (e.g. "The `node` row is suspended: …"), since a blockquote can't sit inside a table.

## Files to Change

- `docs/agents/specs/arcanum-cli/shared-config-logic.md`: 5 banners.
- `docs/agents/specs/arcanum-cli.md`: 1 banner, under the Ownership table.
- `docs/agents/specs/arcanum-cli/key-registry.md`: 1 banner.
- `docs/agents/specs/arcanum-cli/packaging-and-release.md`: 1 banner.
