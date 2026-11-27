# Canonical Pointer

Hub: [specs.md](specs.md)

Every generated issue body of a spec-carrying flow carries a canonical pointer to the spec hub. The generation issue creates the file at that path. Every other issue only reads it.

## Format

- The pointer is a single line on its own, starting with the literal key `**Spec hub:** `. It is matched by `^\*\*Spec hub:\*\* `.
- The value is a Markdown link whose text and target are the same repo-relative **hub** path.
- The hub path is `docs/agents/specs/<topic>.md` or `docs/agents/specs/<topic>/specs.md`.
- The issue never lists parts. They are discovered by reading the hub.

A body with no H1 (the shape of a split sub-issue):

```markdown
**Spec hub:** [docs/agents/specs/<topic>/specs.md](docs/agents/specs/<topic>/specs.md)

## Context
...
```

A body that opens with an H1 (the shape of an epic):

```markdown
# <Issue title>

**Spec hub:** [docs/agents/specs/<topic>/specs.md](docs/agents/specs/<topic>/specs.md)

## Context
...
```

## Value rules

- The resolver reads the link **text**. When the text and the target differ, the pointer is `invalid`.
- **Rationale:** the link is deliberately not clickable on GitHub. A repo-relative path stays portable across forks and hosts, and no host, owner or branch is ever parsed out of an issue body.

## Validation

- The path is validated against an allowlist rooted at `docs/agents/specs/`.
- Absolute paths, `..` segments, and anything that escapes that root are rejected before any file read.

## Placement

- The pointer goes on the first non-blank line of the body or, when the body opens with an H1, on the first non-blank line after that H1.
- Emitters (the split and the body templates) write it there. The push guard re-inserts a dropped pointer at the same spot (see [guard.md](guard.md)).
- A normal split of a pointer-carrying issue copies the pointer line verbatim into each sub-issue at that spot (see [reentrancy.md](reentrancy.md)).
- Split sub-issues have no H1 in the body, because the title lives only in the GitHub title. Epics open with `# <title>`. The rule covers both shapes.
- The resolver scans the whole body, and the first match wins (see [resolver.md](resolver.md)). A pointer found anywhere else, or a second pointer line, is still honoured but adds an entry to `warnings[]`.

## Parser

A single parser is shared by the resolver and the push guard, so the two cannot drift. See [resolver.md](resolver.md) and [guard.md](guard.md).
