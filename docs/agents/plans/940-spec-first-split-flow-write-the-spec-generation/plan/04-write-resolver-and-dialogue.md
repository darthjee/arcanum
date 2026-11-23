# Write resolver.md and dialogue.md

Use the same part conventions as step 03: title, hub back-link, normative bullets, **Rationale** paragraphs, and no origin tags.

## `resolver.md` (safety criterion, resolver contract, git evidence)

- **Safety criterion:**
  - Proceeding without a spec is safe when the issue makes **no claim**.
  - A declared but absent or incomplete spec is the unsafe case, so the resolver reports the *contradiction* ("the issue declares a spec at `{path}` and that file does not exist"), not a missing file.
  - Outcomes:
    - absent pointer → silent, today's behaviour
    - pointer and complete spec → read
    - pointer and an absent, incomplete or suspicious path → read nothing, and the human decides
- **States:**
  - `none`: no pointer line (Flow C). Silent, proceed.
  - `ready`: the hub exists and every part it lists exists. Read and proceed.
  - `not_ready`: read nothing. It carries `reason` (`missing` | `partial` | `invalid`), `missing_parts[]` and the raw `source_line`.
- **Output shape:** `{ state, hub, parts[], missing_parts[], reason, source_line, warnings[] }`. It is stable, and both skills and humans consume it.
- **Properties:**
  - **A single implementation.** It is a native command under the core engine (read the hub, list parts, check existence, consult git), with the matching `core/spec` tree, invoked through dispatch and shared by cross-skill reference. There is no shell/native duplication.
  - **No cache.**
  - **An explicit `repo_path`,** with every read scoped under it.
  - **`invalid` never reads.** **Rationale:** the allowlist exists so that an issue body cannot steer a file read.
- **Git evidence for `missing`:**
  - The resolver consults git and does not infer.
  - No deletion history for the path → "spec generation has not run yet".
  - A deletion commit exists → the resolver reports that commit and offers restoration.
  - It reports facts, never whether a deletion was legitimate, because the fold deletes specs on purpose.
  - It also greps `docs/agents` for the fold provenance footer, which turns a bare not-found into "spec removed; content folded into `{destination}`" (link `fold.md`).
- **Restore semantics (confirmed):**
  - Restore checks out only the spec file(s) (the hub, plus its parts or topic directory) from the parent of the deletion commit.
  - It does not revert issues or commits, and it does not re-add the `specs.md` index row.

## `dialogue.md` (shared dialogue, automation, precedence)

- **One dialogue definition,** shared by `discuss-issue`, `plan-issue` and `auto-plan-issue` through cross-skill reference, so the options cannot drift.
- **Options for `missing` and `partial`:**
  - write (or complete) the spec now
  - restore from `{commit}`, offered only when git shows a deletion of that path
  - proceed without the spec, for this session only
  - abort
- **Options for `invalid`:**
  - fix the field to a valid path. This is the only path that passes `--allow-pointer-change` to the push guard; link `guard.md`.
  - proceed without the spec, for this session only
  - abort
- **Writing the spec:** when the user chooses to write it, the skill reports the exact path it will use. In `missing` the path comes from the issue; in `invalid` it has to be defined.
- **Non-persistence:** "proceed without the spec" never mutates the issue, the pointer or any state file.
- **Consumption:** on `ready`, the consumer reads the hub and then its parts before it discusses or plans.
- **Precedence rule:**
  - The spec wins on technical detail.
  - The issue keeps authority over scope and intent.
  - On a scope divergence, the consumer asks the user instead of choosing.
- **Automation behaviour:**
  - Covered skills: `auto-plan-issue` (the only automated resolver caller), and `auto-resolve-issue` and `auto-fix-all`, which pass its failure on.
  - On `not_ready` they fail explicitly. They record the reason and the path, the item leaves the queue, and the loop continues.
  - There is no retry counter, no requeue and no silent continuation.
  - **Rationale:** this needs no new bookkeeping and keeps the invariant that automation does not decide under ambiguity.
  - `monitor-issues` and `auto-rewrite-issue` never plan, so they never call the resolver. Only the guard binds them.
- The interaction mechanics (TTY script versus chat) are an open point (#942). Do not specify them.

## Files to Change
- `docs/agents/specs/spec-first-split-flow/resolver.md` (new): safety criterion, states, output shape, properties, git evidence, restore.
- `docs/agents/specs/spec-first-split-flow/dialogue.md` (new): shared dialogue options, non-persistence, consumption and precedence, automation behaviour.
