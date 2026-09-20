# Codacy: duplication cluster — GithubIssueService vs. shared GithubIssueCreate specs (59 clone groups, 2 files)

## Context

`core/spec/lib/services/GithubIssueService_spec.js` and `core/spec/lib/commands/shared/GithubIssueCreate_spec.js` test the same "create a GitHub issue" behavior from two different call sites (service vs. command wrapper), and duplicate large verbatim blocks: lines 8-34, 55-70, 72-89, 91-102, 104-115, 117-125, and 127-139 are identical between the two files. Codacy reports 59 clone groups and roughly 180 duplicated lines.

## What needs to be done

- Move the shared "create issue" request/response fixtures and assertion helpers into a single `githubIssueCreateSharedExamples.js` support file.
- Have both `GithubIssueService_spec.js` and `GithubIssueCreate_spec.js` include the shared examples, leaving each file only its wrapper-specific test logic.

## Acceptance criteria

- [ ] A `githubIssueCreateSharedExamples.js` file (or equivalent) exists under `core/spec/support` and is included by both specs.
- [ ] The duplicated fixture/assertion blocks are removed from both files in favor of the shared examples.
- [ ] Both specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for these two files drops substantially after the fix lands.
