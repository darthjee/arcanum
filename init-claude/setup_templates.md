# Setup PR and Commit Message Templates

Create `.github/pull_request_template.md` and `.github/commit_message_template.md`.

## Step 1 — Detect existing templates

Check whether `.github/pull_request_template.md` and `.github/commit_message_template.md` already exist.

- If a template already exists, read it. Its content is the baseline — preserve project-specific sections, only filling gaps or applying changes the user requests.
- If a template does not exist, draft it from scratch using the structures below.

## Step 2 — Draft the PR template

Draft `.github/pull_request_template.md` with this structure, adapting section names only if the project already has an established convention (e.g. found in an existing template or in `docs/agents/contributing.md`):

```markdown
## Summary

<!-- One sentence describing what this PR does -->

## Problem

<!-- What problem does this solve? Why is this change needed? -->

## Solution

<!-- How was the problem solved? What approach was taken? -->

## Details

<!-- Optional: implementation notes, migration steps, caveats. Remove this section if not needed. -->

Fixes #
```

## Step 3 — Draft the commit message template

Draft `.github/commit_message_template.md` with this structure:

```markdown
<type>(<scope>): <subject> (issue #<id>)

<optional body: what was done and why, if not obvious>

Co-Authored-By: <AI model name> <AI model email>
Co-Authored-By: <agent> agent <AI model email>
```

If the project does not use conventional commit `<type>(<scope>)` prefixes, simplify the first line to `<subject> (issue #<id>)` instead. If commits aren't tied to issues in this project, drop the `(issue #<id>)` suffix. If no sub-agents are used to author commits (no `.claude/agents/` set up), drop the second `Co-Authored-By` line.

## Step 4 — Present drafts and ask for confirmation

Show both drafted templates to the user and ask:

```
These are the proposed .github/pull_request_template.md and .github/commit_message_template.md. Shall I write them, or would you like to make changes?
```

Wait for the user's response.

- If the user confirms: proceed to write the files.
- If the user requests changes: apply them and ask again before writing.

## Step 5 — Write the templates

Ensure `.github/` exists, then write (or overwrite):
- `.github/pull_request_template.md`
- `.github/commit_message_template.md`

## Step 6 — Confirm

Tell the user:

```
.github/ templates written:
- pull_request_template.md
- commit_message_template.md

GitHub will pick up pull_request_template.md automatically when opening PRs. The commit message template is a reference for the format agents and contributors should follow.
```
