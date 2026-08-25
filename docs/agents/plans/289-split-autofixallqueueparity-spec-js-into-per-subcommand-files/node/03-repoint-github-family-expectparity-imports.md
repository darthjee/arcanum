# Repoint the 6 autoFixAllGithubParity/*.js files' expectParity import

Of the 8 files under `core/spec/bin/autoFixAllGithubParity/`, 6 currently import `expectParity` from `../../support/factories/githubParitySetup.js` (alongside `setupParityTest`, and in `add_tag_spec.js`'s case also `seedGithubLikeRepo`): `add_tag_spec.js`, `has_shipit_label_spec.js`, `pr_merge_spec.js`, `pr_number_spec.js`, `pr_state_spec.js`, `remove_tag_spec.js`. The other 2 — `cleanup_branch_spec.js` and `engine_dispatch_spec.js` — don't use `expectParity` at all (they assert stdout directly) and are untouched by this step.

For each of the 6, move `expectParity` out of the `githubParitySetup.js` import (leaving `setupParityTest`, and `seedGithubLikeRepo` where present) and into that file's existing import from `../../support/utils/runCommand.js` (`runBoth`, in every one of the 6 — since `expectParity` now lives in the same module, it just joins that import's named list, no new import line needed).

Example (`has_shipit_label_spec.js`):

```diff
-import { expectParity, setupParityTest } from '../../support/factories/githubParitySetup.js';
-import { runBoth } from '../../support/utils/runCommand.js';
+import { setupParityTest } from '../../support/factories/githubParitySetup.js';
+import { expectParity, runBoth } from '../../support/utils/runCommand.js';
```

This step depends on step 01 (where `runCommand.js` gains the export) and must land alongside step 02's removal of the old export — the codebase must never sit in a state where `expectParity` is missing from wherever these 8 files import it from.

## Files to Change

- `core/spec/bin/autoFixAllGithubParity/add_tag_spec.js` — repoint `expectParity` import.
- `core/spec/bin/autoFixAllGithubParity/has_shipit_label_spec.js` — repoint `expectParity` import.
- `core/spec/bin/autoFixAllGithubParity/pr_merge_spec.js` — repoint `expectParity` import.
- `core/spec/bin/autoFixAllGithubParity/pr_number_spec.js` — repoint `expectParity` import.
- `core/spec/bin/autoFixAllGithubParity/pr_state_spec.js` — repoint `expectParity` import.
- `core/spec/bin/autoFixAllGithubParity/remove_tag_spec.js` — repoint `expectParity` import.
