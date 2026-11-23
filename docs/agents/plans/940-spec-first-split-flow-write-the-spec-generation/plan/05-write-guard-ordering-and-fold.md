# Write guard.md, ordering.md and fold.md

Use the same part conventions as step 03.

## `guard.md` (shared push guard)

- **Field preservation is a security property.**
  - **Rationale:** the greatest risk to the feature is the issue losing its pointer, not the spec going missing. A rewrite that rebuilds the body drops the pointer, the resolver sees `none`, and automation proceeds with zero errors.
- **Covered skills:** the four that rewrite an existing body are `discuss-issue` (redrafts the sections), `enhance-issue` (publish), `auto-new-issue` (sync from the local file) and `auto-rewrite-issue` (autonomous rewrite).
- **Not covered,** with the reason:
  - `monitor-issues` never pushes a body.
  - `arcanum-split-issue` and `arcanum-create-issue` create bodies rather than rewrite them.
- **Mechanism:**
  - One native-only command, shared by cross-skill reference, runs at every body-push path before `gh issue edit`. It is enforced by code, not by a prompt instruction.
  - It fetches the current body from GitHub, extracts the pointer with the **resolver's parser**, and compares it with the new body.
- **Outcomes:**
  - The current body has no pointer → pass through unchanged.
  - The pointer is kept verbatim → pass.
  - The pointer is dropped → re-insert the original line verbatim at the canonical spot defined in `pointer.md`, warn, and push.
  - The pointer is changed (a different line or path) → refuse with a non-zero exit, unless the caller passes `--allow-pointer-change`. Only the dialogue's "fix the field" option passes it.
- **Required regression tests** (part of the contract):
  - A rewrite that drops the pointer gets it back.
  - A changed pointer without the override fails.
  - A body with no pointer is untouched.

## `ordering.md` ("blocked by" ordering)

- **Rationale:** ordering is enforced by a real dependency mechanism respected at queue entry, not by sub-issue hierarchy, which does not block. Because automation fails on `not_ready`, ordering is what keeps a flow from failing one round per implementation issue.
- **Mechanism:**
  - GitHub native issue dependencies ("blocked by"), created by the split through `/repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by`.
  - Nothing goes into the issue body, so the guard has no second line to protect.
- **Edges per flow:**
  - **Flow B:**
    - Each enhancement issue is blocked by the generation issue.
    - Each implementation issue is blocked by the generation issue and every enhancement issue.
    - The fold issue is blocked by every implementation issue.
  - **Flow A:**
    - The enhancement issues are blocked as in Flow B.
    - The implementation-split issue is blocked by the generation issue and every enhancement issue.
    - The fold issue is blocked by the implementation-split issue.
    - When the reentrant split creates implementation issues, it adds each one as a fold blocker. Reentrancy details are an open point (#941).
  - **Flow C:** no edges.
- **Queue entry (`push-issue-to-queue`):**
  - An issue is accepted when every *open* blocker is already queued ahead of it, or comes earlier in the same push.
  - Otherwise the push is refused with `#<id> is blocked by #<b> — queue #<b> first`, the same way Epics are refused.
  - A whole split can still be queued in order with one command.
- **Pop time (`auto-fix-all`, and `auto-resolve-issue` on start):**
  - Any open blocker → fail explicitly with `blocked by #<b>`. The item leaves the queue, with no requeue and no retry.
  - The resolver's `not_ready` check stays as a second line of defence.
- **Fetch failure:** a failure to fetch dependencies is treated like a label-fetch failure. It never blocks the push, and the pop-time check decides.

## `fold.md` (the fold and its rules)

- **The fold issue:**
  - It runs before any pointer can become orphaned. Its ordering is defined in `ordering.md`.
  - It writes provenance into the destination docs, removes the spec files or topic directory, and removes the `specs.md` index row.
  - It never rewrites historical issues.
  - **Rationale:** provenance at the destination keeps the pointer immutable and lets the resolver turn a not-found into an actionable message.
- **The hub declares the map:**
  - Every pipeline hub carries a `## Fold map`: section/part → a destination under `docs/agents` (existing or newly named) or `drop`.
  - The generation issue starts it, enhancement issues refine it, and the fold only carries it out.
  - The map is reviewable before the fold, so the fold is idempotent and re-runnable. A re-run changes nothing and never duplicates a footer.
- **Fold the final state:**
  - Keep:
    - API definitions
    - command and config contracts
    - usage definitions
    - behaviour other agents rely on
  - Drop:
    - status lines
    - open points and TODOs
    - implementation order and sub-issue lists
    - rollout steps
    - rejected alternatives
    - the `## Fold map` itself
  - Folded content is rewritten into the destination's present-tense voice, never pasted verbatim.
- **Provenance footer:**
  - A visible line at the end of each destination section that received content: ``> Folded from spec `<hub path>` by #<fold issue>.``
  - `<hub path>` is the path the pointer carries (`docs/agents/specs/<topic>.md` or `docs/agents/specs/<topic>/specs.md`).
  - The resolver greps `docs/agents` for that exact path. (See the plan Notes on the hub-path wording.)

## Files to Change
- `docs/agents/specs/spec-first-split-flow/guard.md` (new): push guard contract.
- `docs/agents/specs/spec-first-split-flow/ordering.md` (new): dependency edges, queue-entry and pop-time rules.
- `docs/agents/specs/spec-first-split-flow/fold.md` (new): fold procedure and rules.
