# Plan: Codacy: PMD UnnecessaryBlock false positives — core/ (96 findings, 47 files)

Issue: [609-codacy-pmd-unnecessaryblock-false-positives-core-96-findings-47-files.md](../../issues/609-codacy-pmd-unnecessaryblock-false-positives-core-96-findings-47-files.md)

## Overview

Replace the growing per-file global `exclude_paths` list in `.codacy.yml` (87 files from #509–#514) with one exclusion scoped to PMD: `engines.<pmd-key>.exclude_paths: ["core/**/*.js"]`. This removes the 96 new `PMD_category_ecmascript_codestyle_UnnecessaryBlock` false positives, prevents future ones, and lets every other Codacy tool analyse those 87 files again. `.codacy.yml` is a root-level file, so this is `architect` scope. No JS source changes.

## Context

- PMD's ecmascript parser flags required JS syntax (`try {`, destructuring, returned object literals, `switch` case blocks) as "unnecessary blocks". #509–#514 showed that every finding of this pattern is a false positive.
- The current fix adds files one by one to the **global** `exclude_paths`, which turns off every Codacy tool on them. It also has to be extended whenever new `core/` JS files are added.
- `.codacy.yml` already uses an exclusion scoped to one engine: `engines.opengrep.exclude_paths: ["core/Dockerfile"]` (#604). Its engine key was the tool's `shortName` from Codacy's `api/v3/tools`.

## Implementation Steps

### Step 1 — Find the PMD engine key

Look up the `shortName` of the PMD tool that emits `PMD_category_ecmascript_*` patterns, using Codacy's API (`GET https://app.codacy.com/api/v3/tools`) or Codacy's configuration-file docs. This is the same method #604 used for `opengrep`. Codacy may list more than one PMD tool (e.g. legacy PMD and PMD 7). If more than one is enabled for this repo and could emit the pattern, add an `engines` entry for each one. Record the key(s) and where they were confirmed in the `.codacy.yml` comment (Step 2).

### Step 2 — Rewrite `.codacy.yml`

1. Under `engines:`, next to `opengrep`, add:
   ```yaml
     <pmd-key>:
       exclude_paths:
         - "core/**/*.js"
   ```
2. From the top-level `exclude_paths`, remove all 87 entries under the `# #509`, `# #511`, `# #512`, `# #513` and `# #514` group comments, including the group comments themselves. Keep `core/spec/support/**`, `CLAUDE.md`, `.github/copilot-instructions.md` and `core/yarn.lock`.
3. Replace the header paragraph that starts "Excludes 87 specific files …" with one that says:
   - PMD, and only PMD, is excluded from `core/**/*.js`, because its ecmascript `UnnecessaryBlock` pattern flags required syntax that can't be removed without breaking code or an enabled ESLint rule.
   - The exclusion is scoped to one engine so ESLint, Lizard, Opengrep, etc. keep analysing every `core/` file.
   - The engine key and where it was confirmed (Step 1).
   - References: #509–#514 and #609.
   Keep the `#510` note: `core/spec/support/**` is still excluded globally for its own reason (#460/#496).

## Files to Change

- `.codacy.yml` — add the PMD-scoped engine exclusion, drop the 87 per-file global entries, rewrite the matching header comment.

## CI Checks

- None of the CircleCI jobs cover `.codacy.yml`. Check locally that the YAML still parses, e.g. `ruby -ryaml -e 'YAML.load_file(".codacy.yml")'` or `python3 -c 'import yaml; yaml.safe_load(open(".codacy.yml"))'`.
- The real check is Codacy's analysis on the PR: it should show no `PMD_category_ecmascript_codestyle_UnnecessaryBlock` findings under `core/`.

## Notes

- **Unverified engine key:** if the key is wrong, Codacy silently ignores the `engines` entry and the PMD findings stay. Confirm from Codacy's analysis on the PR that the findings are gone. If they are not, try the other PMD `shortName`.
- **Expected new findings:** putting the 87 files back into analysis for the non-PMD tools may surface real ESLint/Lizard/Opengrep/duplication findings that the global exclusion was hiding. Do **not** fix them in this issue. Leave them for follow-up Codacy issues.
- The glob targets `*.js` only, so PMD keeps whatever coverage it has on non-JS files under `core/` (if any).
