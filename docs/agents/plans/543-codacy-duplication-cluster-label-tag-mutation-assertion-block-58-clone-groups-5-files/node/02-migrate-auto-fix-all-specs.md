# Migrate auto-fix-all command specs

Update the six `auto-fix-all` command specs to use `captureRejection` from step 01 instead of their own inline `let thrown; try {...} catch (error) { thrown = error; }` block. In each case, import `{ captureRejection }` from `'../../../../support/utils/captureRejection.js'` (adjust the relative depth per file), replace the multi-line capture with:

```js
const thrown = await captureRejection(<the call that was previously awaited inline>);
```

and leave every assertion below it (`expect(thrown)...`) exactly as-is — only the capture boilerplate changes, not what's being asserted.

- `AutoFixAllConfig_spec.js` has **two** internal occurrences of the block (around lines 90-98 and 105-113) — migrate both.
- `AutoFixAllCheckoutFromMain_spec.js`'s occurrence (around line 219-226) is followed only by `exitCode`/partial-`stdout` assertions (no exact `stdout` equality) — do not add one.
- `AutoFixAllGithubLabels_spec.js` has two occurrences (around lines 32-42 and 47-57).
- `AutoFixAllQueuePop_spec.js`, `AutoFixAllQueuePush_spec.js`, `AutoFixAllQueueSave_spec.js` each have one occurrence (around lines 74-86, 85-92, 85-92 respectively — verify exact line numbers against current `main`, since the issue's originally-cited line numbers referred to the wrong content).

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllConfig_spec.js` — replace both internal try/catch blocks with `captureRejection`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js` — replace both try/catch blocks with `captureRejection`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePop_spec.js` — replace the try/catch block with `captureRejection`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePush_spec.js` — replace the try/catch block with `captureRejection`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueSave_spec.js` — replace the try/catch block with `captureRejection`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllCheckoutFromMain_spec.js` — replace the try/catch block with `captureRejection`.
