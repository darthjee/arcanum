# Issue: Split specs awareness: Specs concern in the split checklist and a per-repo migration to add it

## Description

**Repo:** darthjee/arcanum
**Related:** Epic #931 *Ensure repos have specs.md*. #932 (merged, `7479875`) and #933 (merged, `fdd4e38`) already make `/init-claude` and `/arcanum-migrate` create `docs/agents/specs.md`, `docs/agents/specs/.gitkeep` and the `AGENTS.md` Specs entry.

This issue does two things:

- **(A) Specs awareness in the split.** `/arcanum-split-issue` learns to take specs into account when breaking an issue down. Its default concerns checklist gains a **Specs** concern, and its exploration step reads `docs/agents/specs.md`. The split still writes only issue drafts.
- **(B) Per-repo migration for the split's checklist.** A new interactive `/arcanum-migrate` entry adds that concern to `docs/agents/arcanum-split-issue.md` in repos that were initialised before the default changed.

### Context — verified state of the codebase

#### The split's per-repo checklist

- `docs/agents/arcanum-split-issue.md` is the split's "usual concerns" checklist. It is seeded only when absent, by `init-claude/scripts/setup_docs_structure_shell.sh` (inline content) and natively by `SPLIT_ISSUE_CONTENT` in `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js`. A parity spec keeps the two engines in sync.
- Current default concerns: sub-issue granularity, standalone clarity, shared contracts, sequencing, responsible agents. No template file exists in `init-claude/templates/`, and the file has no version marker.
- `init-claude/setup_arcanum_split_issue.md` lets the user customise the list and then **overwrites** the file, keeping "a short title, a one-line intro, and a bullet list with one line per concern".
- The split reads the file in `arcanum-split-issue/steps/discuss.md` (step 1, and step 2 for guiding the discussion). It degrades gracefully when the file is missing.
- `arcanum-split-issue/steps/explore.md` looks for precedent, responsible agents and involved code. It does not look at specs.
- The split writes sub-issue drafts only, via `arcanum-split-issue/scripts/create_sub_issue_file.sh` (body authored by the agent, no template).

#### Migrations

- `arcanum/migrations/repos/next/` already holds #933's entries: `001` (`script`, copies `specs.md`) and `002` (`instructions`, adds the Specs row and subsection to `AGENTS.md`). This issue adds the next entry, `003`.
- `next/002.instructions.md` is the precedent for an AI-driven, user-owned-prose edit: add only what is missing, follow the file's existing format, and ask the user when the structure is unrecognisable.
- `core/spec/bin/migrationsSpecsIndex_spec.js` is the precedent contract spec for a `next/` entry.

## Problem

- **The split ignores specs.** A broad issue may need a design agreed first, or may be constrained by an existing spec in `docs/agents/specs/`. Nothing in the split's checklist or steps prompts for either.
- **The split's checklist never evolves in existing repos.** `docs/agents/arcanum-split-issue.md` is seeded once and then owned by the user. When arcanum's default concern list changes, existing repos silently keep the old list, because no migration reconciles it.

## Expected Behavior

1. A freshly `/init-claude`d repo gets the Specs concern in its seeded checklist (both engines, byte-identical).
2. `/arcanum-split-issue` reads `docs/agents/specs.md` (when present) during exploration, and proposes a dedicated "write the spec" sub-issue when a part of the work needs a design no spec covers yet.
3. Running `/arcanum-migrate` on a repo whose checklist predates this change adds the Specs concern. It never rewords, reorders or removes existing items.
4. The migration is skippable and idempotent: a second run changes nothing (ledger plus the "already present" check).
5. A repo without `docs/agents/arcanum-split-issue.md` is left untouched by the migration.

## Solution

### Scope

- **"Specs awareness" means checklist plus reading specs, not writing them.**
  - The default split checklist gets a new concern along the lines of: **Specs** — does any part of this issue need a design agreed first in `docs/agents/specs/`? Is an existing spec listed in `docs/agents/specs.md` relevant to how the work is split?
  - `arcanum-split-issue`'s exploration/discussion steps (`steps/explore.md` and/or `steps/discuss.md`) read `docs/agents/specs.md` when it exists and consult the relevant specs. If it is missing, they degrade gracefully, the same way the step already does for the checklist.
  - The split still writes **only** issue drafts under `docs/agents/issues/`. It does **not** write or register specs, so no new script entrypoint, `engine_dispatch` shim or `migration-status.json` entry is needed. A "split emits specs" capability is out of scope and can be opened as a separate issue later if wanted.
- **The migration targets only the split checklist, `docs/agents/arcanum-split-issue.md`.**
  - Its job is to bring the new specs concern into repos that were initialised before the default changed.
  - `docs/agents/specs.md` and the `## Documentation` section of `AGENTS.md` stay as #933 left them: create-where-absent, handled by `next/001` and `next/002`. This issue does **not** reopen #931/#933's "repair an existing `specs.md` is out of scope" decision.
- **The new default concern must land in both places that seed the checklist:** the inline content in `init-claude/scripts/setup_docs_structure_shell.sh` and `SPLIT_ISSUE_CONTENT` in `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js` (with the parity spec). Freshly initialised and migrated repos must converge.

### Migration layout

- **A single `instructions` entry:** `arcanum/migrations/repos/next/003.md` (description) plus `arcanum/migrations/repos/next/003.instructions.md`. It is registered in `next/migrations.json` with `type: "instructions"`, `applies_to: "repo"` and `skippable: true`, numbered with `generate_next.sh` after #933's `next/001` and `next/002`. It follows the same pattern as `next/002.instructions.md`.
- **What the instructions do:**
  1. If `docs/agents/arcanum-split-issue.md` does **not** exist, make no change and mark the entry complete. The split already runs without the file, the user may have deleted it on purpose, and re-running `/init-claude` seeds it with the new default.
  2. If it exists and already has a concern about specs or designs agreed up front (any wording), make no change.
  3. Otherwise, add the Specs concern bullet to the concern list, following the file's existing style. For example, if the user's bullets use a different shape, express the new concern in that shape.
  4. Never reword, reorder or remove any existing item.
- **No `script` entry and no version marker.** The only change is adding one item to a user-owned list, which needs judgement (is a similar concern already there?) rather than a mechanical edit. That is the same reasoning #933 used for `AGENTS.md`. Idempotence comes from the ledger (`ledger.sh mark-complete`) plus rule 2 above. No provenance marker is introduced.
- **Where the canonical bullet comes from:** there is no template file for the checklist; its default lives inline in both seed sources. `003.instructions.md` quotes the exact bullet text verbatim, and the drift-guard spec (see Testing strategy) keeps it equal to the seed. Moving the seed into `init-claude/templates/` is not required.
- **Trade-off:** convergence with fresh installs holds for every repo that still has the checklist file. "Already has a specs concern" is decided by the AI hand-off, not by a mechanical check, by design.

### Detecting the Specs concern

The `next/003` instructions entry decides **by AI judgement** whether the repo's checklist already has a specs-like concern. The ledger prevents re-runs. No marker of any kind is added to generated docs. Alternatives considered and rejected:

- **Per-item hidden marker** (e.g. `<!-- arcanum:concern specs -->` on the seeded bullet): repos seeded earlier never carry it, so the AI check is needed anyway. It would only help hypothetical future migrations.
- **File-level version marker**: `setup_arcanum_split_issue.md` would have to keep the marker through its wholesale rewrite. It only pays off if the default checklist changes often, which it does not today.
- **Textual grep for `spec`**: deterministic, but likely to produce false positives (e.g. "test spec") and to miss reworded equivalents.

If later migrations change the default checklist often, a marker can be reconsidered in its own issue.

### Wording of the concern and the skill-step changes

**New default concern.** It is appended to the default list in both seed sources (`init-claude/scripts/setup_docs_structure_shell.sh` and `SPLIT_ISSUE_CONTENT` in `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js`), as a single line like the existing bullets. It is also the bullet `next/003` adds to existing repos:

```markdown
- **Specs** — does any part of this work need a design agreed in `docs/agents/specs/` first (worth its own "write the spec" sub-issue), and do existing specs listed in `docs/agents/specs.md` constrain how the sub-issues are shaped?
```

**`arcanum-split-issue/steps/explore.md`** gets a new item 4 in its "Look for" list:

> 4. Existing specs — if `docs/agents/specs.md` exists, read it and open the specs whose topic overlaps the issue; they are agreed designs that constrain the split. Skip if missing.

**`arcanum-split-issue/steps/discuss.md`** step 2 gets an added sentence:

> If a part of the work needs a design that no spec covers yet, propose a dedicated "write the spec" sub-issue (sequenced first) rather than having the split author the spec itself.

The split still never writes a spec; a "write the spec" sub-issue is an ordinary issue draft.

### Testing strategy

Three automated checks are required. No manual dry-run is required.

1. **Seed specs updated.** `core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js` and `core/spec/bin/initClaudeSetupDocsStructureParity_spec.js` assert that the seeded `docs/agents/arcanum-split-issue.md` contains the new Specs bullet, and that the shell and native engines still produce byte-identical output.
2. **Manifest contract.** A spec (for example alongside `core/spec/bin/migrationsSpecsIndex_spec.js`) asserts that `arcanum/migrations/repos/next/migrations.json` declares `003` with `type: "instructions"`, `skippable: true` and `applies_to: "repo"`, and that `arcanum/migrations/repos/next/003.md` and `arcanum/migrations/repos/next/003.instructions.md` exist. Each migration file is named by its full string literal, per the Per-Repo Migrations "Referencing pending migrations" convention.
3. **Drift guard.** A spec asserts that the exact Specs bullet quoted in `arcanum/migrations/repos/next/003.instructions.md` appears verbatim in the checklist seeded by `/init-claude`, so the migration and fresh installs cannot drift apart.

The AI judgement inside the instructions entry (whether a specs-like concern is already present) is not automatically tested, consistent with `next/002`.

### Remaining defaults

- **Edge case — unrecognisable checklist:** if `docs/agents/arcanum-split-issue.md` exists but has no recognisable concern list, `next/003` asks the user where, or whether, to add the concern, the way `next/002` does. It does not guess.
- **Interaction:** no new interaction layer. The existing `run.sh` flow (`[A]ll/[N]one/[S]elect/[C]hat`, `FALLBACK=chat` → `AskUserQuestion`, and the `AI_INSTRUCTIONS=` hand-off) is enough. There is no per-file diff prompt.
- **Performance & security:** not applicable.
- **New root-level folder:** none.

### Out of scope

- The split **writing** specs (`docs/agents/specs/<topic>.md`) or registering them in `docs/agents/specs.md`. A "write the spec" sub-issue is an ordinary issue draft.
- Updating an existing `docs/agents/specs.md` or `AGENTS.md` Documentation section to a newer template. These stay create-only, as decided in #931/#933.
- A provenance or version marker in generated docs.
- Moving the inline placeholders (including the split checklist) into `init-claude/templates/`. This is optional and can be done separately.
- `arcanum-update`, which moves the install rather than the consuming repository.

### Owner

- `scripter`: the new default bullet in `init-claude/scripts/setup_docs_structure_shell.sh`.
- `node`: `SPLIT_ISSUE_CONTENT` in `InitClaudeSetupDocsStructure.js`, the seed/parity spec updates, and the manifest-contract and drift-guard specs.
- `skill-writer`: `arcanum-split-issue/steps/explore.md` and `steps/discuss.md`.
- `architect`: `arcanum/migrations/repos/next/003.md`, `003.instructions.md` and the `next/migrations.json` entry.

### Dependencies

- None open. #932 and #933 are merged, and `next/003` follows #933's `next/001` and `next/002`.

## Benefits

- Broad issues that need a design first get split with an explicit "write the spec" step instead of skipping it.
- Existing specs inform how work is broken down.
- Gives the split's per-repo checklist a supported evolution path for the first time, so new and existing repos converge.
