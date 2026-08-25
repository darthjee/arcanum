# Export TAG_TO_LABEL from Tags.js

`IssueTagger.js` currently re-derives `TAG_TO_LABEL` from `Tags.js`'s `LABEL_TO_TAG` via `Object.fromEntries(Object.entries(LABEL_TO_TAG).map(...))`. `AutoFixAllGithub.js` does the exact same inversion independently. Move the inversion into `Tags.js` itself as a second named export, so both consumers (and the future thin `AutoFixAllGithub` facade) import it directly instead of re-deriving it.

Do this first — it's small, low-risk, and every later step's spec assertions can rely on the single shared export rather than a local re-derivation.

## Files to Change

- `core/lib/utils/issue/Tags.js` — add and export `TAG_TO_LABEL`, computed once via the same `Object.fromEntries(Object.entries(LABEL_TO_TAG).map(([label, tag]) => [tag, label]))` inversion currently duplicated in `IssueTagger.js` and `AutoFixAllGithub.js`.
- `core/lib/utils/issue/IssueTagger.js` — import `TAG_TO_LABEL` from `Tags.js` instead of computing it locally; remove the local `Object.fromEntries(...)` derivation.
- `core/spec/lib/utils/issue/Tags_spec.js` — add coverage for the new `TAG_TO_LABEL` export (correct inversion of `LABEL_TO_TAG`).
