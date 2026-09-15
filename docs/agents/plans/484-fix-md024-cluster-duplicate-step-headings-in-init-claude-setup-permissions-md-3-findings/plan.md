# Plan: Fix MD024 cluster: duplicate step headings in init-claude/setup_permissions.md (3 findings)

Issue: [484-fix-md024-cluster-duplicate-step-headings-in-init-claude-setup-permissions-md-3-findings.md](../../issues/484-fix-md024-cluster-duplicate-step-headings-in-init-claude-setup-permissions-md-3-findings.md)

## Overview

`init-claude/setup_permissions.md` has two sibling top-level sections that deliberately share the same 3-step heading shape (`## Step 1 — Ask the user`, `## Step 2 — Explain`, `## Step 3 — Write the exemption`), which trips markdownlint's default MD024 ("no duplicate headings") rule even though the duplication is intentional and parallel by design. The fix is a repo-root markdownlint config enabling `MD024.siblings_only: true`, which only flags a heading as duplicate when it repeats under the *same* parent — a pure config change, with no edits to `setup_permissions.md` itself. This is a root-level, cross-cutting file, so it's owned directly by `architect` rather than split across specialist agents.

## Context

- Codacy's markdownlint currently flags 3 MD024 findings at `init-claude/setup_permissions.md:37,45,53` — see the issue for the exact headings and line numbers.
- Confirmed during discussion: this repo has no `.markdownlint.json`/`.markdownlint.yaml`/`.markdownlintrc` anywhere today, and no other file/config in the repo references `MD024` or relies on markdownlint's non-siblings-only cross-section behavior — `siblings_only` only *relaxes* the rule, so there's no compatibility risk to check for elsewhere.
- There is no local CI job that runs markdownlint (checked `.circleci/config.yml` and `.github/`) — Codacy runs this analysis on its own, server-side, on the next push/PR scan. Verification of this fix happens by observing Codacy's next scan, not a local command.

## Implementation Steps

### Step 1 — Add a repo-root markdownlint config enabling `siblings_only`

Create `.markdownlint.json` at the repo root:

```json
{
  "MD024": {
    "siblings_only": true
  }
}
```

Only sets `MD024.siblings_only`; every other rule keeps markdownlint's built-in defaults (a config object with a single rule key does not disable unrelated rules).

### Step 2 — Verify, and fall back if needed

Push and let Codacy re-scan `init-claude/setup_permissions.md`. If the 3 MD024 findings clear, this issue is done — no changes needed to `setup_permissions.md`.

If Codacy's markdownlint tool does **not** pick up the repo's `.markdownlint.json` (e.g. because Codacy pins its own ruleset independent of in-repo config), fall back to dispatching `skill-writer` to rename the 3 duplicated headings in `init-claude/setup_permissions.md` to be unique while keeping their parallel wording, e.g.:
- Section 1 (`shipit`-Merge exemption): `## Step 1 — Ask the user (shipit-merge)`, `## Step 2 — Explain (shipit-merge)`, `## Step 3 — Write the exemption (shipit-merge)`
- Section 2 (specialist-dispatch exemption): `## Step 1 — Ask the user (specialist-dispatch)`, `## Step 2 — Explain (specialist-dispatch)`, `## Step 3 — Write the exemption (specialist-dispatch)`
- Any cross-references to these headings elsewhere in the skill docs would need the same suffix.

## Files to Change

- `.markdownlint.json` — new repo-root config enabling `MD024.siblings_only: true`.
- `init-claude/setup_permissions.md` — only touched if the Step 2 fallback is needed; renames the 3 duplicated `## Step N` headings per section to keep them unique.

## Notes

- Whether Codacy honors an in-repo `.markdownlint.json` for its markdownlint tool is the one open unknown here; Step 2 is written as verify-then-fallback specifically because this can't be confirmed until Codacy actually re-scans the pushed config.
- No `## CI Checks` section: no local CI job runs markdownlint in this repo today, so there's no local command to add here.
