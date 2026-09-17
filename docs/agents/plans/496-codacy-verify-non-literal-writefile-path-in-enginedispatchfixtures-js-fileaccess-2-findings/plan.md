# Plan: Codacy: verify non-literal writeFile path in engineDispatchFixtures.js (FileAccess, 2 findings)

Issue: [496_codacy-verify-non-literal-writefile-path-in-enginedispatchfixtures-js-fileaccess-2-findings.md](../../issues/496-codacy-verify-non-literal-writefile-path-in-enginedispatchfixtures-js-fileaccess-2-findings.md)

## Overview

Add a repo-root `.codacy.yml` that excludes `core/spec/support/**` from Codacy analysis, closing the two still-open `detect-non-literal-fs-filename` findings on `engineDispatchFixtures.js` and preempting the same false-positive class recurring for the other spec-support files noted in #460 (`gitFixtureRepo.js`, `autoFixAllCheckoutFromMainParitySetup.js`).

## Context

Issue #460 investigated this exact false-positive pattern and its fix (PR #468) only added rationale comments in code — comments have no effect on Codacy's hosted scan, so the two findings never actually closed (confirmed still `OnTrack` via the Codacy SRM API: resultDataId `131532134675` and `131532134676`). No Codacy MCP tool in this environment can write a dashboard-side ignore rule, so the only agent-achievable durable fix is an in-repo `.codacy.yml` exclusion. This is a repo-root config file, not owned by any specialist agent's scope (`node` is scoped to `core/`'s own source/config, not repo-root files) — the architect owns it directly per its "root-level files" scope.

## Implementation Steps

### Step 1 — Add `.codacy.yml` excluding `core/spec/support/**`

Create `.codacy.yml` at the repo root:

```yaml
# Excludes test-support helpers (fixtures/factories/utils) that build
# throwaway files under a trusted, test-controlled temp directory —
# Codacy's detect-non-literal-fs-filename (and similar) rules can't see
# that the directory is trusted and flag it as a false positive on every
# writeFile/mkdir/chmod call here. See issues #460 and #496.
exclude_paths:
  - "core/spec/support/**"
```

Verify the `exclude_paths` key/schema against current Codacy documentation before committing — this plan was written without access to a live Codacy config validator.

## Files to Change

- `.codacy.yml` — new file, repo root; excludes `core/spec/support/**` from Codacy analysis.

## Notes

- This is broader than the two flagged findings: it silences *any* Codacy check (coverage, complexity, other security rules) on files under `core/spec/support/`, not just `detect-non-literal-fs-filename` — a deliberate tradeoff the user confirmed during discussion, to close the whole recurring false-positive class at once rather than file-by-file.
- The existing rationale comments in `engineDispatchFixtures.js`, `gitFixtureRepo.js`, and `autoFixAllCheckoutFromMainParitySetup.js` (added by #460/PR #468) can stay as human-readable documentation even though they don't affect Codacy's scan.
- Closure can only be confirmed on Codacy's *next* scheduled analysis after this merges (asynchronous, outside this session) — check that resultDataId `131532134675` and `131532134676` move to a closed status and no new findings appear under `core/spec/support/**`.
