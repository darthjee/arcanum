# Topic-Driven Discussion and Publish the Parent Draft

## 1. Read the project's usual splitting concerns

Read `docs/agents/arcanum-split-issue.md` in the target repo, if it exists. Degrade gracefully if it's missing — proceed with only the issue-derived concerns below, exactly like `enhance-issue` does when `docs/agents/issue-enhancement.md` is missing.

## 2. Discuss

Hold an open dialogue with the user about how to break this issue into sub-issues: propose alternatives, ask follow-up questions, surface trade-offs. One topic is always how the sub-issues should be split — if the user has no preference, decide on their behalf. Use `docs/agents/arcanum-split-issue.md`'s checklist (when present) alongside the exploration from [explore.md](explore.md) and `FILE`'s own content to guide what to cover.

As the discussion progresses, append the outcome to `FILE` (the local issue draft from [fetch.md](fetch.md)) — add or update a section capturing what was decided (e.g. a `## Split` section listing the agreed sub-issues and the rationale behind the split). Always write in English, translating if the conversation was in another language.

Keep discussing until the user says they're satisfied with the split overall.

## 3. Publish the parent draft to GitHub

Once satisfied, push the current state of `FILE` to the live GitHub issue immediately — before generating any sub-issue file — so the discussion is preserved even if a later step fails:

```bash
../scripts/github.sh update "$REPO_PATH" <id> "<Title>" <issue_file_path>
```

> Resolve `../scripts/github.sh` relative to this file's directory.

Proceed to [split.md](split.md).
