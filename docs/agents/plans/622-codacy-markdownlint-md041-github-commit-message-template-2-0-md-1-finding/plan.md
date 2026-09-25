# Plan: Codacy: markdownlint MD041 — .github/commit_message_template-2.0.md (1 finding)

Issue: [622-codacy-markdownlint-md041-github-commit-message-template-2-0-md-1-finding.md](../../issues/622-codacy-markdownlint-md041-github-commit-message-template-2-0-md-1-finding.md)

## Overview

Silence Codacy's markdownlint MD041 findings on all seven literal template files (#622–#628). The fix adds a markdownlint-only `exclude_paths` block to `.codacy.yml`. Codacy does not honor `.markdownlintignore`, where #502 already lists these files. No template content changes. This is a root-level config change, so it is owned by the architect; no specialist agent is involved.

## Context

- The seven files: `.github/{pull_request_template,commit_message_template,commit_message_template-2.0}.md`, their byte-identical mirrors under `init-claude/templates/`, and `auto-fix-all/templates/reply.tmpl.md`.
- Most of them are emitted verbatim into commit messages, PR bodies, or reply comments, so adding a `#` heading is not an option.
- The mirrors are enforced by `scripts/check_commit_template_sync.sh` and `core/spec/bin/initClaudeSetupTemplatesParity_spec.js`. Those checks stay untouched.
- `.codacy.yml` already uses engine-scoped exclusions (`opengrep`, `pmd`). Each one is documented in the file's header comment and names the engine by its Codacy `shortName`.
- Codacy's public API (`https://app.codacy.com/api/v3/tools`) confirms the markdownlint tool's `shortName` is `markdownlint`.

## Implementation Steps

### Step 1 — Add the markdownlint engine exclusion to `.codacy.yml`

Under `engines:`, add:

```yaml
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

Add a paragraph to the header comment, in the same style as the `opengrep`/`pmd` paragraphs, stating that:

- these files are excluded from the markdownlint engine only;
- the other tools keep analysing them;
- they are literal templates whose content is substituted verbatim into commit messages, PR bodies, and reply comments, so a `# Title` line added to satisfy MD041 would leak into that output;
- Codacy does not honor `.markdownlintignore`, which already lists them for local runs;
- the engine key `markdownlint` is the tool's `shortName` in Codacy's API (api/v3/tools);
- the list must stay in step with the template block in `.markdownlintignore`;
- the change covers issues #502 and #622–#628.

Leave the global `exclude_paths` untouched. Excluding these files globally would switch off every tool on them.

### Step 2 — Cross-reference from `.markdownlintignore`

In the comment above the template block in `.markdownlintignore`, add one line noting that the same paths are mirrored in `.codacy.yml` under `engines.markdownlint.exclude_paths`, because Codacy ignores this file, and that the two lists must stay in sync. Do not change any path entries.

## Files to Change

- `.codacy.yml` — new `engines.markdownlint.exclude_paths` block plus explanatory header comment.
- `.markdownlintignore` — comment-only cross-reference to the `.codacy.yml` block.

## CI Checks

- No CircleCI job lints Markdown or validates `.codacy.yml`. Codacy picks the change up on the PR. Verify there that the seven MD041 findings disappear and no other markdownlint findings vanish unexpectedly.
- Sanity check: `ruby -ryaml -e 'YAML.load_file(".codacy.yml")'` (or any YAML parser) must parse the file.

## Notes

- The PR body must close all seven issues: `Closes #622`, `Closes #623`, `Closes #624`, `Closes #625`, `Closes #626`, `Closes #627`, `Closes #628`.
- If Codacy still reports the findings after merge, fall back to adding the paths to the global `exclude_paths`. Only markdownlint currently flags them, so the practical impact is small, but document it in the comment.
