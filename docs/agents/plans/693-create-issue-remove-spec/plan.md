# Plan: Create-issue: remove spec

Issue: [693-create-issue-remove-spec.md](../../issues/693-create-issue-remove-spec.md)

## Overview
Delete the temporary `docs/agents/specs/arcanum-create-issue.md`. The part of its contract that no other doc covers moves to a new `docs/agents/architecture/arcanum-create-issue.md`, and every code comment that points to the spec is updated to point to the new doc.

## Context
The spec was the contract for #689–#692, and all four have shipped. Most of its rules already have a permanent home:
- `docs/agents/architecture/issue-tags.md`: Epic, the split parent, the migrations, the automation skip and the `shipit` wording
- `skill-finish.md`: the closing report and the Epic-based next step
- `script-engine.md`: native-only entrypoints
- `entrypoint-migration-status.md`: `has-label`
- `arcanum-create-issue/steps/*.md`: the exact `AskUserQuestion` wording

The rest is only in the spec: the draft file, the native command contract, the label rules and the edge cases. The user chose a new architecture doc that keeps only that contract, with no scope, testing, open-points or "Implemented in #..." bookkeeping.

No agent split: almost all of the work is under `docs/agents/**`, which the architect owns. The code changes are comment-only link updates that go with the doc move, so a single owner keeps the move in one atomic change.

## Steps

- [01 — Write the architecture doc](plan/01-write-architecture-doc.md)
- [02 — Repoint code comments](plan/02-repoint-code-comments.md)
- [03 — Delete the spec and verify](plan/03-delete-spec-and-verify.md)

## CI Checks
- `core/`: `make core-check` or `cd core && yarn lint` (CI job: `checks`). The JS changes touch only comments, but lint still runs on them.

## Notes
- Leave historical files under `docs/agents/issues/` and `docs/agents/plans/` unchanged.
- `docs/agents/specs/` stays, because `shell-engine-removal.md` is still there. `AGENTS.md` and `docs/agents/folder-structure.md` need no change.
- Out of scope: `core/spec/bin/autoFixAllGithubParity/has_label_spec.js:13` links to `docs/agents/plans/692-.../plan.md`, which no longer exists. It is a dead link, but not a spec reference.
