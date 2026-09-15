# Issue: Fix MD024 cluster: duplicate step headings in init-claude/setup_permissions.md (3 findings)

## Description
Codacy's markdownlint flags 3 MD024 findings ("Multiple headings with the same content") in `init-claude/setup_permissions.md`:

- `init-claude/setup_permissions.md:37` — `## Step 1 — Ask the user`
- `init-claude/setup_permissions.md:45` — `## Step 2 — Explain`
- `init-claude/setup_permissions.md:53` — `## Step 3 — Write the exemption`

The file has two top-level sections — `# Setup the \`shipit\`-Merge Permission Exemption` (starting line 1) and `# Setup the Common Specialist-Dispatch Permission Exemption` (starting line 33) — each with its own `## Step 1 — Ask the user` / `## Step 2 — Explain` / `## Step 3 — Write the exemption` sub-headings. markdownlint's default MD024 config flags identical heading text anywhere in the document, even under different parent sections.

## Problem
This is a real duplicate-heading pattern, but the headings are duplicated *by design*: both procedures deliberately follow the same 3-step shape, and renaming them (e.g. "Step 1 — Ask the user (shipit-merge)" / "Step 1 — Ask the user (specialist-dispatch)") would work but lose the clean parallelism, and would need to be repeated for every future procedure added to this file. markdownlint has a built-in option for exactly this shape — `MD024.siblings_only: true` — which only flags a heading as duplicate when it repeats under the *same* parent, not across sibling sections.

There is currently no `.markdownlint.json`/`.markdownlint.yaml` config anywhere in this repo, so this is the first time repo-wide markdownlint config is being introduced — confirmed by searching the repo for any existing markdownlint or Codacy config file.

## Expected Behavior
- All 3 MD024 findings in `init-claude/setup_permissions.md` are resolved.
- The two procedures' step headings keep their current, parallel wording.
- Re-running markdownlint/Codacy on this file shows zero MD024 findings.

## Solution
- Add a repo-root markdownlint config (e.g. `.markdownlint.json`) enabling `MD024.siblings_only: true`.
- Confirm Codacy's markdownlint tool picks up the repo's config (vs. only its own default ruleset) — if it doesn't, fall back to renaming the 3 duplicated headings in `init-claude/setup_permissions.md` to be unique instead (e.g. suffixing each with its section name).
- Check whether any other file in the repo relies on markdownlint's default (non-siblings-only) MD024 behavior in a way `siblings_only` would newly miss — unlikely, since `siblings_only` only *relaxes* the rule.

Delegate to the `skill-writer` agent for the `init-claude/setup_permissions.md` content (if renaming is needed as a fallback), and to `architect` for the repo-root markdownlint config, since it is not scoped to any single existing specialist agent.

## Benefits
- Clears all 3 outstanding MD024 warnings without sacrificing the file's parallel step structure.
- A repo-wide `siblings_only` config (if Codacy honors it) prevents the same false-positive class from recurring in any future skill doc with repeated step headings across sections.
