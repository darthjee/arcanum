# Issue: use tag to describe what issue AI is writting

## Description
The `Writting` label currently covers two different situations: a human drafting an issue on their own, and the `enhance-issue` skill actively holding an AI-assisted dialogue to flesh the issue out. Nothing currently distinguishes "AI is actively working on this issue" from "still just an idea, untouched."

## Problem
Looking at an issue's labels today, there's no way to tell whether `enhance-issue` is currently in progress on it versus it simply sitting in the `Idea`/`Writting` backlog. This makes it hard to see, at a glance across the issue tracker, which issues are actively being worked on by AI right now.

## Expected Behavior
- When `enhance-issue` fetches an issue (start of its dialogue), the issue is tagged `Enhancing` and its `Idea`/`Writting` tags are removed.
- When `enhance-issue` publishes back to GitHub (end of its dialogue), the issue is tagged `Created` (as already happens today via `mark-created`) and `Idea`/`Writting`/`Enhancing` are all removed.
- This is scoped to `enhance-issue` only — `discuss-issue` (a separate, later AI-assisted dialogue stage) is untouched by this issue.

## Solution
1. **New label**: add `Enhancing` (color `#335ecc`) to `init-claude`'s `DEFAULT_LABEL_PAIRS` (`scripts/lib/label_config.sh`), same as any other default label. No retroactive sync for already-initialized repos — a repo picks it up the next time `init-claude` (re-)runs on it, consistent with how other labels are onboarded.
2. **New `mark-enhancing` command**: add it to the canonical `github_issue.sh` lib, alongside the existing `mark-created`/`mark-refined`/`mark-ready`. It adds `Enhancing` and removes `Idea`/`Writting`, best-effort/non-blocking, matching the existing `mark-*` command pattern.
3. **Wire it into `enhance-issue`'s fetch step**: `enhance-issue`'s fetch step currently calls `discuss-issue`'s shared `resolve_and_fetch.sh`/`cmd_fetch` directly — that script must stay untouched since `discuss-issue` reuses it and must not start tagging `Enhancing`. Instead, right after `enhance-issue/steps/fetch.md` interprets `STATUS=ok` (before handing off to `explore.md`), call `../scripts/github.sh mark-enhancing "$REPO_PATH" <id>` — reusing `enhance-issue`'s existing `github.sh` wrapper, the same one `publish.md` already uses for `mark-created`. This runs unconditionally whenever fetch resolves `STATUS=ok`, whether the draft was freshly fetched from GitHub or resumed from an existing local file, so re-entering `enhance-issue` on an issue always (re-)marks it `Enhancing`.
4. **Extend `mark-created` to also remove `Enhancing`**: `enhance-issue`'s publish step already calls `mark-created`, which today only removes `Idea`/`Writting`. It needs to be extended to also remove `Enhancing`, so the tag doesn't linger after publish.

The `Redined` label mentioned in the original ask was a typo for the existing `Created` label — no new terminal label is introduced, and the pipeline stays as it is today (`Idea`/`Writting` → `Created` → `Refined` → `Ready`).

## Benefits
- Anyone scanning the issue tracker can immediately see which issues have AI actively enhancing them right now versus ones still sitting untouched in the backlog.
- Keeps the existing `Created`/`Refined`/`Ready` pipeline semantics unchanged — `Enhancing` is purely an additive, transient signal.
