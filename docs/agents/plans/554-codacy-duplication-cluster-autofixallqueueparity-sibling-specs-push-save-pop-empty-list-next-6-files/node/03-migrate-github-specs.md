# Migrate the github specs (push/save)
Rewrite `push_spec.js` and `save_spec.js` as `itMatchesShellForQueueOp(...)` calls with `github: true`. Keep the `describe` labels, `it` descriptions, header comments, and the inline comments explaining the expected per-tag stdout lines, placed next to the case data.

Case mapping:
- `push` "no ids": seed `['existing']`, args `[]`, no extra env, no fakeFetch, `expectedCode: NON_ZERO`, stdout `''`.
- `push` success: seed `['existing']`, args `['30']`, env `{ FAKE_GH_ISSUE_LABELS: 'Ready for Work', FAKE_FETCH_ISSUE_LABELS: 'Ready for Work' }`, fakeFetch, code 0, the current four-line stdout, followUp `{ op: 'list', expectedStdout: 'existing\n30\n' }`.
- `push` label edit fails: same seed/args, env adds `FAKE_GH_ISSUE_EDIT_FAIL: '1'` and `FAKE_FETCH_ISSUE_EDIT_FAIL: '1'` to the labels env, fakeFetch, code 0, the current two-line stdout.
- `save` "no ids": no seed, args `[]`, `NON_ZERO`, stdout `''`.
- `save` success: no seed, args `['10','20']`, env `{ FAKE_GH_ISSUE_LABELS: '', FAKE_FETCH_ISSUE_LABELS: '' }`, fakeFetch, code 0, the current seven-line stdout.
- `save` view fails: no seed, args `['10']`, env `{ FAKE_GH_ISSUE_VIEW_FAIL: '1', FAKE_FETCH_ISSUE_VIEW_FAIL: '1' }`, fakeFetch, code 0, `'Queue saved: 10\n'`.

To remove the remaining repetition, share the labels env in `push_spec.js` through a local constant that is spread into both cases. Run `npm test` and `npm run lint` in `core/` and confirm that all seven specs still pass with the same test count.

## Files to Change
- `core/spec/bin/autoFixAllQueueParity/push_spec.js`
- `core/spec/bin/autoFixAllQueueParity/save_spec.js`
