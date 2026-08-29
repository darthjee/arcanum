# Replace takesRepoContext with the context enum in the registry

Reshape `core/lib/core/commands.js` so each entry declares
`context: 'repo' | 'claude' | 'none'` instead of the `takesRepoContext` boolean.

- Update the `CommandEntry` typedef: drop `@property {boolean} [takesRepoContext]`,
  add `@property {'repo'|'claude'|'none'} [context]` with a description of the
  three behaviours (see plan.md contract 4). Note `absent ≡ 'none'`.
- Mechanically convert **every** current `takesRepoContext: true` entry to
  `context: 'repo'`. Per the current registry that is: the four
  `arcanum-split-issue-*`, `auto-fix-all-checkout-from-main`,
  `auto-fix-all-cleanup-artifacts`, the seven `auto-fix-all-github-*`,
  `auto-fix-all-reply-comment`, `auto-fix-all-wait-ci`,
  `auto-fix-all-wait-ci-and-merge`, `checkout-safe-branch`,
  `dispatch-fixture-repo-context`, `github-issue-create`, `github-issue-info`,
  `issue-state`, `list-agents`, `resolve-and-fetch`, `resolve-id-and-file`,
  `resolve-plan-paths`, `spawn-issue`.
- Leave the `context: 'none'` entries unmarked (absent): `dispatch-fixture`,
  `dispatch-fixture-crash`, `auto-fix-all-config-*`, `auto-fix-all-queue-*`,
  `arcanum-update-run-update-*`. Optionally add a short top-of-file comment
  listing them and why (this is the comment #314's own plan expected to add —
  adding it here is fine and saves #314 the work).
- `permission-grant` is set to `context: 'claude'` in step 04, not here (keep
  this step a pure boolean→enum rename so its diff is reviewable on its own).

Update `core/spec/lib/core/commands_spec.js`: the current test asserts the exact
list of `takesRepoContext` entries. Replace it with two assertions — the exact
list of `context: 'repo'` entries (same list as above), and that
`permission-grant` is `context: 'claude'` (add after step 04 lands, or wire it
now and let step 04 satisfy it). Keep the `log: false` and
`module`/`method`-shape assertions.

## Files to Change

- `core/lib/core/commands.js` — `CommandEntry` typedef; every
  `takesRepoContext: true` → `context: 'repo'`; optional exempt-list comment.
- `core/spec/lib/core/commands_spec.js` — swap the `takesRepoContext` list
  assertion for a `context: 'repo'` list assertion (+ the `permission-grant`
  `'claude'` check).
