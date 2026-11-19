# Specs

Permanent index of feature specs under [`docs/agents/specs/`](specs/). A spec is a forward-looking design for work that is still being implemented or decided. Unlike an issue or plan, a spec is not tied to one issue or implementation cycle.

This index remains in the repository even when no active specs exist. It is not a copy of the specs: it gives agents and maintainers a searchable list of active features, with one-line summaries and links to the authoritative spec hubs.

## Writing specs

- A feature spec starts at `docs/agents/specs/<topic>.md`, where `<topic>` is a kebab-case name describing the feature.
- The topic hub summarizes the feature, lists its status and scope, and links to the detailed part files. It may contain the full specification when the feature is small enough.
- A growing spec is split into `docs/agents/specs/<topic>/<part>.md`. The hub remains the entry point and should link to every part.
- Part files may grow large and be split further using a stable, descriptive subdirectory or filename structure. Do not create a nested hierarchy unless it makes navigation clearer.
- Keep the hub small enough to orient a reader: status, goal, scope, key decisions, open points, and links to details.
- Keep links, filenames, status, and the index entry synchronized. A removed or completed spec must be removed from this index.

## File layout

```text
docs/agents/specs/<topic>.md          # topic hub; may contain the complete small spec
docs/agents/specs/<topic>/<part>.md   # detailed part of a larger spec
```

## Lifecycle

1. Add the new topic hub and, only if needed, its initial part files.
2. Add a row here with the spec name, a short summary, and its current status.
3. Update the hub and parts as the design changes while implementation remains in progress.
4. When implementation is complete and the spec is no longer needed as forward-looking guidance, remove the spec entry and the spec files, or preserve an explicit historical decision elsewhere if maintainers require it.

## Active specs

| Spec | Summary | Status |
| --- | --- | --- |
