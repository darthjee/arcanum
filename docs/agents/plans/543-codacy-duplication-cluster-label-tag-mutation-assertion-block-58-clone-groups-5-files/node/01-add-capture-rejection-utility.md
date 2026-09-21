# Add the shared captureRejection utility

Add `core/spec/support/utils/captureRejection.js`, alongside the existing sibling `captureStdout.js`. Base it on the private helper `DiscussIssueConfirm_spec.js` already defines locally (`core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js:10-18`) — same signature and behavior, just promoted to a shared file:

```js
/**
 * Await `promise` and capture a rejection instead of letting it
 * propagate, so specs can assert on the thrown error without a
 * hand-rolled `let thrown; try {...} catch {...}` block.
 * @param {Promise} promise - the promise to await and capture a
 *   rejection from.
 * @returns {Promise<Error|undefined>} the rejection, or `undefined` if
 *   the promise resolved.
 */
export async function captureRejection(promise) {
  try {
    await promise;

    return undefined;
  } catch (error) {
    return error;
  }
}
```

Follow the JSDoc style already used in `core/spec/support/utils/captureStdout.js` (module-level function doc, no file-level banner comment).

## Files to Change

- `core/spec/support/utils/captureRejection.js` — new file, single exported `captureRejection(promise)` function as above.
