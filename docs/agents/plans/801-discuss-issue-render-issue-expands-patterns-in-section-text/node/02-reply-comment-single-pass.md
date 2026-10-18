# Single-pass render in AutoFixAllReplyComment

`_renderTemplate` already avoids `$` expansion through `_replaceFirst`, but it
substitutes sequentially, so a reply body containing `%%AGENT%%` gets that text
replaced. Switch to the same single-pass regex + replacer approach as step 01, over
`BODY|AGENT|MODEL_NAME|MODEL_EMAIL`. Remove `_replaceFirst` if nothing else uses it,
and update the JSDoc, which currently claims to match bash `${var/pattern/repl}`, to
describe the new contract.

## Files to Change

- `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js` — single-pass substitution, JSDoc.
