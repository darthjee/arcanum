# Codacy: duplication cluster — MergeBodyResolver_spec.js self-duplication + PrOperationsPrMerge_spec.js (17 clone groups, 2 files)

## Context

`core/spec/lib/utils/github/MergeBodyResolver_spec.js` repeats its own body-resolution assertion block at least four times (roughly lines 70-82/179-190, 104-115/179-190, 90-96/151-157, 93-98/169-174), and shares a 5-6 line fragment of that same block with `core/spec/lib/utils/github/PrOperationsPrMerge_spec.js`. Codacy reports 17 clone groups and roughly 50 duplicated lines across the pair.

## What needs to be done

- Extract a `resolvesMergeBody(template, expected)` shared example covering all resolver-template variants.
- Reuse the shared example in both `MergeBodyResolver_spec.js` and `PrOperationsPrMerge_spec.js`.

## Acceptance criteria

- [ ] A `resolvesMergeBody(template, expected)` shared example exists and is used by both files.
- [ ] The duplicated body-resolution assertion blocks are removed in favor of the shared example.
- [ ] Both specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this pair drops substantially after the fix lands.
