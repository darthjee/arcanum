# Architect Plan: Codacy: markdownlint MD033 cluster — inline HTML in markdown (18 findings, 10 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — see [plan.md](plan.md).

## Implementation Steps

### Step 1 — Fence the commit-message templates, and stop hand-syncing the two copies

`.github/commit_message_template.md`, `.github/commit_message_template-2.0.md`, `init-claude/templates/commit_message_template.md`, and `init-claude/templates/commit_message_template-2.0.md` are the bulk of the MD033 findings — their bodies are bare placeholder tags (`<type>`, `<scope>`, `<id>`, `<agent>`, `<AI model name>`, …) outside any code span or fence. Confirmed these files are never parsed programmatically for their content — `arcanum/_lib/commit_template.sh` only checks for their *existence* (`[[ -f ... ]]`) to pick "new" vs "old" template shape — so reformatting the body is safe. Confirmed each `.github/` copy is byte-identical to its `init-claude/templates/` counterpart today.

Wrap each file's template body (the commit-message lines themselves — for the `-2.0` file, that is lines 1–8 only; its explanatory prose below stays as plain Markdown, it has no inline HTML) in a single ` ```text ` fenced code block, per this repo's MD040 convention (fences must carry a language — see `AGENTS.md`/`README.md` for existing ` ```text ` usage). Keep the fenced body **byte-for-byte identical** between each `.github/` file and its `init-claude/templates/` counterpart — do not let the wording drift while fixing formatting.

Then add a lightweight, non-blocking CI backstop so the two copies of each template can't silently diverge again (this repo already has a precedent for this shape of check: `scripts/check_tags_table.sh`, wired into the `build-and-release` CircleCI job — this one should be much simpler, with no GitHub-issue-filing step, since a two-file diff is much lower stakes than the tag-mutations table):

- Add `scripts/check_commit_template_sync.sh`: diffs `.github/commit_message_template.md` against `init-claude/templates/commit_message_template.md`, and `.github/commit_message_template-2.0.md` against `init-claude/templates/commit_message_template-2.0.md`. On a mismatch, print the diff to stderr with a one-line instruction ("keep both copies identical"); always `exit 0` — this must never block a build.
- Wire it into `.circleci/config.yml`'s `checks` job (runs on every push, not just tag pushes) as a new non-blocking step, following the existing `yarn duplication || true` / `yarn audit || true` style already in that job. The script runs from the repo root, so call it with a path relative to `checks`' `working_directory: ~/project/core` (e.g. `../scripts/check_commit_template_sync.sh`).

### Step 2 — Backtick-wrap the placeholder in `docs/agents/architecture/agent-roster-and-delegation.md`

Line 23 has one bare placeholder inside a long descriptive sentence: `` `<agent-name>.md` `` — check the exact text; the sentence already backtick-wraps most of its other placeholders (e.g. `` `list_plan_agents.sh` ``), so this is a one-token fix to match the surrounding convention. Confirm with `npx markdownlint-cli2 docs/agents/architecture/agent-roster-and-delegation.md` (this repo's `.markdownlint.json` is picked up automatically) that no MD033 error remains on that line afterward — a local run found this file's actual flagged element is `raw` from a slightly different phrase than the one in the issue's example, so re-check rather than assuming the exact wording.

## Files to Change

- `.github/commit_message_template.md` — fence the whole body in a ` ```text ` block
- `.github/commit_message_template-2.0.md` — fence the template lines (1–8) in a ` ```text ` block; leave the explanatory prose below untouched
- `init-claude/templates/commit_message_template.md` — same fence, kept byte-identical to the `.github/` copy
- `init-claude/templates/commit_message_template-2.0.md` — same fence, kept byte-identical to the `.github/` copy
- `scripts/check_commit_template_sync.sh` — new non-blocking drift check (see Step 1)
- `.circleci/config.yml` — add the new check as a step in the `checks` job
- `docs/agents/architecture/agent-roster-and-delegation.md` — backtick-wrap the remaining bare placeholder

## Notes

- Codacy's issue lists 3 findings per commit-template file; a local `npx markdownlint-cli2 <file>` run (using this repo's own `.markdownlint.json`) found 8 per file instead. Fence the *entire* template body rather than chasing an exact count, then re-run markdownlint locally to confirm zero MD033 errors remain in each file touched.
- `.github/` and everything under `docs/` (except `docs/guides/`) are excluded from the release zip (`scripts/build_release_zip.sh`), so none of this step's files ship to consumer repos — this is dev-only/self-hosting content for the arcanum repo itself.
