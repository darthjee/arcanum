# Issue: Codacy: markdownlint MD041 — .github/commit_message_template-2.0.md (1 finding)

## Description
Codacy reports markdownlint MD041 ("First line in a file should be a top-level heading", severity Info) on `.github/commit_message_template-2.0.md:1`. Sibling issues #623–#628 report the same finding on the other six literal template files:

- `.github/commit_message_template-2.0.md` (#622)
- `.github/commit_message_template.md` (#623)
- `.github/pull_request_template.md` (#624)
- `auto-fix-all/templates/reply.tmpl.md` (#625)
- `init-claude/templates/commit_message_template-2.0.md` (#626)
- `init-claude/templates/commit_message_template.md` (#627)
- `init-claude/templates/pull_request_template.md` (#628)

All seven files have been listed in `.markdownlintignore` since #502. Codacy still flagged them in its 2026-09-24 snapshot (commit `f56d4bb`), so Codacy does not honor `.markdownlintignore`. The #502 exclusion only silences local markdownlint runs.

This issue fixes all seven findings in a single change.

## Problem
- Codacy ignores `.markdownlintignore`, so the #502 exclusion has no effect there.
- Most of these files are substituted verbatim into commit messages, PR bodies, and reply comments. Adding a `#` heading would leak into that generated output, so a heading is not a valid fix for them as a group.
- `.github/*` and `init-claude/templates/*` are byte-identical mirrors, enforced by `scripts/check_commit_template_sync.sh` and `core/spec/bin/initClaudeSetupTemplatesParity_spec.js`. The template files themselves must therefore stay untouched, or be changed in lockstep.

## Expected Behavior
- Codacy reports zero `markdownlint_MD041` findings for all seven template files.
- No template file content changes, so commit messages, PR bodies, and replies are generated exactly as before.
- Codacy's markdownlint keeps analysing every other Markdown file; only these paths are excluded, and only for markdownlint.
- The `.markdownlint.json` rules and the `.markdownlintignore` entries stay as they are; the ignore entries still serve local runs.
- The template-sync check and the parity spec still pass.

## Solution
Add a markdownlint-only exclusion to `.codacy.yml`, following the existing `opengrep`/`pmd` pattern:

```yaml
engines:
  markdownlint:
    exclude_paths:
      - ".github/pull_request_template.md"
      - ".github/commit_message_template.md"
      - ".github/commit_message_template-2.0.md"
      - "init-claude/templates/pull_request_template.md"
      - "init-claude/templates/commit_message_template.md"
      - "init-claude/templates/commit_message_template-2.0.md"
      - "auto-fix-all/templates/reply.tmpl.md"
```

- Before relying on the engine key, check that it matches the markdownlint tool's `shortName` in Codacy's API (api/v3/tools), as was done for `opengrep`/`pmd`.
- Add a comment block to the header of `.codacy.yml`. It should say that these are literal templates whose content is emitted verbatim, so a heading would leak into the output, and that Codacy does not honor `.markdownlintignore`. Reference #502 and #622–#628.
- Keep the path list in step with the template block in `.markdownlintignore`, and add a note in each file pointing to the other.
- The PR closes #622 through #628 (`Closes #623`, … in the PR body).
