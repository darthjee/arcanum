# Plan: Enhance spec: key-registry.md

Issue: [772-enhance-spec-key-registry-md.md](../../issues/772-enhance-spec-key-registry-md.md)

## Overview

Docs-only rewrite of `docs/agents/specs/arcanum-cli/key-registry.md` so that every decision recorded in the issue's `## Solution` is written into the spec and its `## Open points` list is resolved, then align the sibling spec parts and the index with those decisions. Owner: `architect` (no specialist agent has work — no code changes).

## Context

`key-registry.md` currently leaves file format, location/owner, wildcard matching, code consumption, rule enforcement and the final seed list open, and its seed table is incomplete and partly wrong versus the runtime (missing `engine.log.location`, `git.omit_model_coauthor`, `git.remove_coauthors`; `engine.mode` tiers; `git.safe_branch` tier; `git.merge_body_mode` default). The issue's Solution section is the source of truth for every decision; this plan only says where each goes.

## Steps

- [01 — Rewrite key-registry.md](plan/01-rewrite-key-registry.md)
- [02 — Align sibling spec parts](plan/02-align-sibling-specs.md)
- [03 — Update the index](plan/03-update-index.md)

## CI Checks

- No CI job validates `docs/agents/specs/`; there is no markdown lint. Verify manually that every relative link and `#anchor` touched resolves (e.g. `grep` the target headings).

## Notes

- Docs only — no `core/`, `arcanum/` or `cli/` changes; `keys.json`, `KeyRegistry.js`, the drift spec, the strict-keys guard and the shell scan spec are #777's work.
- Keep the spec style used by the sibling parts: short bullet decisions, `## Alternatives considered`, and an `## Open points` list (which should end empty or only hold genuinely external items).
- Anchors referenced from other files (`key-registry.md#entry-shape`, `#open-points`) must keep resolving or be updated in the same change.
