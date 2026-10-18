# Issue: discuss-issue render_issue expands $ patterns in section text

## Description

`discuss-issue`'s issue renderer does not insert section text verbatim. Both
implementations behind the `render_issue.sh` engine_dispatch shim substitute each
`%%PLACEHOLDER%%` with a mechanism that interprets special sequences in the
*replacement* text:

- **Native** — `core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js` (lines
  59-65) uses `String.prototype.replace(placeholder, text)`. Even with a string
  pattern, JavaScript expands `$&` (the match), `` $` `` (everything before it),
  `$'` (everything after it) and `$$` in `text`.
- **Shell** — `discuss-issue/scripts/render_issue_shell.sh` (lines 31-36) uses
  `${content/\%\%X\%\%/$VAR}`. On bash ≥ 5.2 (`patsub_replacement`, on by default)
  an unquoted `&` in the replacement expands to the matched text, and backslashes
  are processed. Verified locally: `/opt/homebrew/bin/bash` 5.3 renders
  `x&y \\z` as `x%%X%%y \z`, while `/bin/bash` 3.2 keeps it verbatim. The shim's
  `#!/usr/bin/env bash` picks whichever bash is first on `PATH`.

Both implementations also substitute placeholders **sequentially**, so a section that
literally contains a later placeholder (e.g. a Description quoting `%%SOLUTION%%`) gets
that text replaced too.

The same shell bug exists in `auto-fix-all/scripts/reply_comment_shell.sh` (lines
53-56), which fills `%%BODY%%` with the free-text `$REPLY_BODY`. A PR reply
containing `&` is corrupted on bash ≥ 5.2. Its native twin,
`core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js`, already uses a safe
index/slice `_replaceFirst`, but it is still sequential.

## Problem

Found while discussing #797: its Solution section contained `` `$` `` several times
(e.g. `` `$.state` ``), and the rendered file came out with
Description/Problem/Expected Behavior duplicated inside the Solution. The workaround
was to escape every `$` as `$$`, which is only correct for the native path and
corrupts the shell path.

The parity specs did not catch this because no fixture contains `$`, `&`, `\` or a
placeholder, and the two implementations are wrong in *different* ways, so parity
breaks too.

## Expected Behavior

- In `discuss-issue`'s render_issue and `auto-fix-all`'s reply_comment, every
  substituted value (sections, title, reply body, agent, model name and email) is
  inserted byte-for-byte verbatim, whatever `$`, `&`, `\` or `%%PLACEHOLDER%%`
  sequences it contains.
- This holds on the native path and on the shell path, on both bash 3.2 and
  bash ≥ 5.2.
- Shell and native output stay byte-identical (parity specs).
- No command in `core/lib` passes a variable value as the replacement *string* of
  `String.prototype.replace`/`replaceAll`.

## Solution

- **Single-pass substitution everywhere.** Each template is filled in one pass, so
  substituted text is never re-scanned for placeholders:
  - **Native** (`DiscussIssueRenderIssue.js`, `AutoFixAllReplyComment.js`): one
    regex over the known placeholders with a replacer function looking up the value,
    e.g. `template.replace(/%%(TITLE|DESCRIPTION|…)%%/g, (_, key) => values[key])`.
    A replacer function's return value is inserted verbatim.
  - **Shell** (`render_issue_shell.sh`, `reply_comment_shell.sh`): export the values
    as env vars and substitute with one perl pass, e.g.
    `perl -pe 's/%%(TITLE|DESCRIPTION|…)%%/$ENV{"R_$1"}/g'`. Perl inserts the value
    verbatim and does not re-scan it. Verified on bash 3.2 and 5.3 with
    `x&y \\z $& %%B%%`. `render_issue_shell.sh` already depends on perl. This
    replaces the `${content/…/$VAR}` substitutions, so `patsub_replacement` no
    longer matters.
  - Keep first-occurrence vs. all-occurrences semantics identical to today's
    behavior (each placeholder appears once in each template), and keep the
    blank-line collapsing in `render_issue` unchanged.
- **Harden the `{agent}` calls**: `replaceAll('{agent}', …)` in
  `AutoNewIssueCommitIssue.js`, `AutoPlanIssueCommitPlan.js` and
  `AutoFixIssueCommitChange.js` switch to a replacer function
  (`replaceAll('{agent}', () => agent)`). Agent names are low risk, but this keeps
  `core/lib` free of the pattern.
- **Specs**:
  - Extend the native unit specs and both parity specs
    (`discussIssueRenderIssueParity_spec.js` and reply_comment's) with fixtures
    containing `$&`, `` $` ``, `$'`, `$$`, `&`, `\`, `\\` and a literal
    `%%OTHER_PLACEHOLDER%%` in every value.
  - Assert verbatim output, not just parity.
  - Run the shell side under the bash on `PATH`. The local/CI bash version should
    expose the ≥ 5.2 case where available.
  - Add a case per hardened `{agent}` command with a `$&`-containing agent name.

## Benefits

- Issue files and PR replies render correctly no matter what they contain. Arcanum's
  own issues regularly quote mod/JS code full of `$`, and plain prose full of `&`.
- The shell/native parity guarantee holds for real-world input, not just plain
  fixtures.
