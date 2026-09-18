# architect Plan: Codacy: markdownlint MD041 cluster — first line should be a top-level heading (40 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — independent of skill-writer's work.

## Implementation Steps

### Step 1 — Update `.markdownlint.json` to resolve 33 of the 40 findings via config only

- Extend the `front_matter_title` option so MD041 also treats a `name:` frontmatter key as a title, resolving the ~24 `SKILL.md` / `.claude/agents/*.md` files without touching their content. Default regex is `^\s*title\s*[:=]`; change it to also match `name`, e.g. `^\s*(title|name)\s*[:=]`.
- Add these 7 literal template files to the exclusion list — their content is substituted verbatim into real commit messages, PR bodies, and reply comments, so a heading would corrupt that output: `.github/pull_request_template.md`, `.github/commit_message_template.md`, `.github/commit_message_template-2.0.md`, `init-claude/templates/pull_request_template.md`, `init-claude/templates/commit_message_template.md`, `init-claude/templates/commit_message_template-2.0.md`, `auto-fix-all/templates/reply.tmpl.md`.
- Add `CLAUDE.md` and `.github/copilot-instructions.md` to the exclusion list too, mirroring the existing `.codacy.yml` exclusion added for these same 2 files in #498 (deliberate 1-line redirect stubs to `AGENTS.md`).
- Document each exclusion group with an inline comment explaining why, matching `.codacy.yml`'s existing comment style.

## Files to Change

- `.markdownlint.json` — extend `front_matter_title`; add an exclusion list for the 9 listed paths, with explanatory comments.

## Notes

- Confirm the exact config key/format markdownlint (or markdownlint-cli2, whichever tool Codacy runs against this repo) expects for per-file exclusion before writing it — the current `.markdownlint.json` only sets rule options (`MD024`, `MD013`), no exclusion mechanism yet, so this introduces a new pattern to the file.
- After the config change, spot-check a couple of frontmatter files (e.g. `discuss-issue/SKILL.md`, `.claude/agents/architect.md`) and the 9 excluded files locally with the `markdownlint` CLI if available, to confirm MD041 no longer fires on any of them.
