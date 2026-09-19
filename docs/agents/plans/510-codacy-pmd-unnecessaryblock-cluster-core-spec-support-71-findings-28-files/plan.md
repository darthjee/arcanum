# Plan: Codacy: PMD UnnecessaryBlock cluster — core/spec/support (71 findings, 28 files)

Issue: [510-codacy-pmd-unnecessaryblock-cluster-core-spec-support-71-findings-28-files.md](../../issues/510-codacy-pmd-unnecessaryblock-cluster-core-spec-support-71-findings-28-files.md)

## Overview

This issue's 71 PMD `UnnecessaryBlock` findings under `core/spec/support/` are already resolved. `.codacy.yml` has excluded the whole `core/spec/support/**` directory from Codacy analysis since issue #496 (an unrelated FileAccess/`detect-non-literal-fs-filename` false-positive fix), and that directory-wide exclusion also suppresses this cluster. The just-merged fix for the sibling issue #509 confirmed this explicitly in its `.codacy.yml` comment: "#510 already covered by the pre-existing core/spec/support exclusion." No code edit and no further `.codacy.yml` change are needed.

## Context

Five sibling clusters of the same repo-wide `PMD_category_ecmascript_codestyle_UnnecessaryBlock` pattern (#509, #511, #512, #513, #514) required real `.codacy.yml` `exclude_paths` additions, because PMD's ecmascript parser misidentifies required JS syntax (try openers, destructuring, returned object literals) as unnecessary blocks in those directories. `core/spec/support/` is different: it was already fully excluded from Codacy for an earlier, unrelated reason (#496), so this cluster's findings are already suppressed with no action needed here.

## Implementation Steps

### Step 1 — Verify zero live findings

Confirm (e.g. via the Codacy MCP tools — `codacy_list_repository_issues` / `codacy_get_repository_with_analysis` filtered to `core/spec/support/**`) that no live `PMD_category_ecmascript_codestyle_UnnecessaryBlock` findings remain under `core/spec/support/`. No repository file needs editing for this verification; `.codacy.yml`'s existing `core/spec/support/**` exclude entry (present since #496, reconfirmed by #509) already covers it.

## Files to Change

None — `.codacy.yml` already excludes `core/spec/support/**`.

## Notes

- No PR-worthy code or config change results from this plan; it exists to document the verification needed to close #510.
- If verification in Step 1 turns up live findings elsewhere (indicating the exclusion somehow doesn't apply, e.g. a Codacy config caching issue), stop and escalate — that would mean this plan's premise is wrong and needs re-evaluation, not a mechanical block removal.
