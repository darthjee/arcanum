# Resolver confinement rule and cross-references

Add the one normative rule this issue introduces outside `reentrancy.md`, then one-line cross-references in the parts whose decisions it touches. Each cross-reference is a single sentence linking to `reentrancy.md`; do not copy its content.

- `resolver.md`: add the confinement rule, e.g. under `## Properties` or a short new `## Part paths` section: the part paths the hub lists are confined under the spec's own root (`docs/agents/specs/<topic>/`, or the hub alone for the single-file layout); a part link that escapes it makes the pointer `not_ready` with `reason: invalid`, and nothing is read. Also mention this case in the `not_ready` / `invalid` description if it currently only covers the pointer path. Add a one-line cross-reference for the readiness gate: the spec-driven split additionally requires the hub's `Status` to be `Ready` (see [reentrancy.md](reentrancy.md)).
- `pointer.md`: one line (e.g. in `## Placement`) that a normal split of a pointer-carrying parent copies the pointer line verbatim into each sub-issue at the canonical spot (see [reentrancy.md](reentrancy.md)).
- `ordering.md`: replace "The reentrancy details are an open point (#941)." in the Flow A edges with a one-line reference: the reentrant split's links (fold blockers and the confirmed order between implementation issues) are defined in [reentrancy.md](reentrancy.md).
- `dialogue.md`: one line that the spec-driven split reuses this dialogue on `not_ready`, where "proceed without the spec" drops it to a normal split (see [reentrancy.md](reentrancy.md)).

## Files to Change
- `docs/agents/specs/spec-first-split-flow/resolver.md` — part-path confinement rule; readiness-gate cross-reference.
- `docs/agents/specs/spec-first-split-flow/pointer.md` — pointer-inheritance cross-reference.
- `docs/agents/specs/spec-first-split-flow/ordering.md` — replace the #941 open-point sentence with a cross-reference.
- `docs/agents/specs/spec-first-split-flow/dialogue.md` — readiness-gate cross-reference.
