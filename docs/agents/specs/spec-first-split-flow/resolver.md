# Safety Criterion and Resolver

Hub: [specs.md](specs.md)

## Safety criterion

The safety criterion is the claim, not the file.

- Proceeding without a spec is safe when the issue makes **no claim**.
- A declared spec that is absent or incomplete is the unsafe case: the issue asserts a technical contract, and the implementation would run without it.

The outcomes are:

- Absent pointer: silent, today's behaviour.
- Pointer and a complete spec: read it.
- Pointer and an absent, incomplete or suspicious path: read nothing, and the human decides.

The anomaly the resolver reports is therefore the *contradiction* ("the issue declares a spec at `{path}` and that file does not exist"), not a missing file.

## States

The resolver returns one of three states, with a single blocking point:

- `none`: no pointer line (Flow C). Silent; proceed.
- `ready`: the hub exists and every part it lists exists. Read and proceed.
- `not_ready`: read nothing. It carries `reason` (`missing` | `partial` | `invalid`), `missing_parts[]` and the raw `source_line`.

The spec-driven split additionally requires the hub's `Status` to be `Ready` (see [reentrancy.md](reentrancy.md)).

## Part paths

- The part paths the hub lists are confined under the spec's own root: `docs/agents/specs/<topic>/`, or the hub alone for the single-file layout.
- A part link that escapes that root makes the pointer `not_ready` with `reason: invalid`, and nothing is read.

## Output shape

```text
{ state, hub, parts[], missing_parts[], reason, source_line, warnings[] }
```

The shape is stable. Skills and humans both consume it.

## Properties

- **A single implementation.** The resolver is a native command under the core engine (read the hub, list parts, check existence, consult git), with the matching `core/spec` tree. It is invoked through dispatch and shared by cross-skill reference. There is no shell/native duplication.
- **No cache.** The invalidation surface is not worth a few milliseconds of file reads.
- **An explicit `repo_path`.** Every read is scoped under it.
- **`invalid` never reads.** **Rationale:** the allowlist exists so that an issue body cannot steer a file read.

The pointer is parsed as defined in [pointer.md](pointer.md).

## Git evidence for `missing`

For `reason: missing`, the resolver consults git and does not infer why the file is absent:

- No deletion history for the path: the spec never existed, so "spec generation has not run yet".
- A deletion commit exists: the spec existed and was removed. The resolver reports that commit and offers restoration.

The resolver reports facts. It never judges whether a deletion was legitimate, because the fold deletes specs on purpose.

It also greps `docs/agents` for the fold provenance footer (see [fold.md](fold.md)). A match turns a bare not-found into "spec removed; content folded into `{destination}`".

## Restore semantics

- Restore checks out only the spec file or files (the hub, plus its parts or topic directory) from the parent of the deletion commit.
- It does not revert issues or commits, and it does not re-add the `specs.md` index row.
