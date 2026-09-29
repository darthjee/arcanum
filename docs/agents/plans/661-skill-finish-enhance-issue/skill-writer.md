# Plan: Skill finish: enhance-issue

Issue: [661-skill-finish-enhance-issue.md](../../issues/661-skill-finish-enhance-issue.md)

## Overview
Rewrite the ending of `enhance-issue` against `docs/agents/specs/skill-finish.md`, mirroring what #660 did for `discuss-issue` (`discuss-issue/steps/discuss_and_save.md`: "Closing report", "Failed exits", "Abandoning the refinement (declined)", refine-change derivation, step 8 offer handling; `discuss-issue/steps/extract_id_and_name.md`: failed report on `resolve_and_fetch.sh` failure). No script changes. The shared scripts already exist.

## Context
- Current ending: `enhance-issue/steps/publish.md` runs `github.sh update` and `mark-created`, deletes the draft, releases the tree, and prints an ad-hoc confirmation (§4). There is no next-step offer and no defined decline or failure exits.
- `fetch.md` runs `mark-enhancing` right after `resolve_and_fetch.sh` returns `STATUS=ok`. Its stdout contains `Removed tag '<tag>'` / `Added tag '<tag>'` lines from `arcanum/_lib/tag_mutate.sh`.
- `enhance-issue` is never nested (`arcanum-split-issue` only chains to it), so no `NESTED=true` handling and no `--merge`.
- Decisions from the issue:
  - report both label swaps;
  - on declined/failed, leave `Enhancing` in place and keep the local draft;
  - only the success path deletes the draft.

## Steps

- [01 — Record the enhancing change and fail on fetch errors](skill-writer/01-fetch-exits.md)
- [02 — Add the declined exit to the dialogue](skill-writer/02-dialogue-declined.md)
- [03 — Standard finish in publish](skill-writer/03-publish-finish.md)

## CI Checks
- Markdown is checked by Codacy (markdownlint). Keep fenced code blocks tagged with a language and tables well-formed (see #632's MD060 finding).
- No `core/` code changes, so `yarn test` / `yarn lint` (CircleCI `test` / `checks`) are unaffected.

## Notes
- Keep all script paths resolved relative to the step file's directory, and always pass `"$REPO_PATH"` explicitly (Repo Path Threading).
- The report must be relayed verbatim as the last thing printed before the offer. Never hand-format it.
- `skill-reviewer` should confirm no complex inline bash was introduced. Label-change derivation stays as prose rules, same as `discuss-issue`.
