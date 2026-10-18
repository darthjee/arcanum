# Single-pass render in DiscussIssueRenderIssue

Replace the chained `.replace('%%X%%', value)` calls in
`DiscussIssueRenderIssue#run` (lines 59-65) with one pass, for example
`template.replace(/%%(TITLE|DESCRIPTION|PROBLEM|EXPECTED_BEHAVIOR|SOLUTION|BENEFITS)%%/g, (_, key) => values[key])`.
A replacer function's return value is inserted verbatim, and the matched text is never
re-scanned. Keep the blank-line collapsing and the `${content}\n` write unchanged.
Update the JSDoc to state the verbatim, single-pass guarantee.

## Files to Change

- `core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js` — single-pass, replacer-function substitution.
