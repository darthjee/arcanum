# Plan: Enhance spec: shortcuts-and-setup.md

Issue: [771-enhance-spec-shortcuts-and-setup-md.md](../../issues/771-enhance-spec-shortcuts-and-setup-md.md)

## Overview

This change is docs only. It rewrites `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` into a complete spec, using the decisions recorded in the issue's "Solution" section:

- the shortcut syntax and output;
- the `agents email` display;
- the `ignore-checks` add/remove semantics;
- the wizard's coverage, order and flow.

It then makes the small cross-file updates that keep `command-surface.md`, `key-registry.md`, `shared-config-logic.md` and the index `arcanum-cli.md` consistent with those decisions.

## Context

- **Origin.** The issue is part of epic #767 (arcanum user-facing CLI), and is a sibling of #770, which enhanced `command-surface.md`. The current file has four open points, all resolved in the issue: shortcut output, wizard coverage and order, wizard Ctrl-C behaviour, and the `agents email` display.
- **Prior art.** `command-surface.md`, as merged in #770 (commit 671dee3), sets the house style this file must follow. Its section order is Purpose, Decisions, Edge cases, Backward compatibility, Testing, Performance, Security, Alternatives considered, Open points. It also defines the exit codes, the stdout/stderr split, the JSON conventions and the error wording.
- **Runtime facts the spec must stay consistent with:**
  - `arcanum/_lib/agent_email.sh` resolves agent emails per tier, trying two keys in each tier.
  - `core/lib/utils/config/RepoConfig.js#getIgnoredCheckPatterns` reads `ignored_check_patterns` from the repo tier only.
  - `core/lib/services/PrChecker.js` treats those patterns as case-insensitive regexes.
- **Index.** The index keeps no consolidated open-points list, so the issue's "update the index's open-points list" bullet is moot.

## Steps

- [01 — Rewrite shortcuts-and-setup.md](plan/01-rewrite-shortcuts-and-setup.md)
- [02 — Update command-surface.md](plan/02-update-command-surface.md)
- [03 — Update key-registry.md](plan/03-update-key-registry.md)
- [04 — Update shared-config-logic.md and the index](plan/04-update-shared-config-logic-and-index.md)

## Notes

- No code, no migration, no new root-level folder.
- Only `architect` has work (all files are under `docs/agents/specs/`), so there is no agent split.
- No CI job covers `docs/`. Check the result by hand:
  - relative links resolve;
  - anchors referenced across files (e.g. `command-surface.md#json-output`, `#exit-codes`) still exist;
  - no open point that the issue resolved is left listed.
- Follow the repo's docs writing style, as in `command-surface.md`: short sentences, tables for enumerations, and `text`/`json` fenced examples.
- Do not settle questions owned by sibling issues: the registry file format (#777) and the shared-surface file list. Reference them as dependencies instead.
