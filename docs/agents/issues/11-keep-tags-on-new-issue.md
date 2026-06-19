# Keep tags on new-issue

## Context

`new-issue` removes the tags of an issue read from GitHub. It should keep the tags at the end of the issue body. Tags are set at the end, after `---`, on a new line as `tags: :some_tag:`. When `new-issue` fetches a GitHub issue and rewrites it into its own structured template, this trailing tags block is currently dropped.

## What needs to be done

- In `new-issue/steps/collect_and_save.md`, before restructuring a fetched GitHub body into the issue template, detect a trailing `---` / `tags: ...` block at the end of the body.
- After writing the restructured content, re-append that same `---` / `tags: ...` block verbatim at the end of the file.
- Apply the same handling in `auto-new-issue/steps/write_issue.md`, since it performs the same kind of fetch-then-restructure rewrite autonomously.

## Acceptance criteria

- [ ] A GitHub issue body ending in `---\ntags: :some_tag:` keeps that exact block at the end of the file written by `new-issue`.
- [ ] The same holds for `auto-new-issue`.
- [ ] Issue bodies with no trailing tags block are unaffected (no spurious tags line added).

---

tags: :shipit:
