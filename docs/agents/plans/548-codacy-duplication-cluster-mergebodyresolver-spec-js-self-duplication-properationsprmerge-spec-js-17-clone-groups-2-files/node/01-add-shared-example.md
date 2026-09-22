# Add the merge-body-resolution shared example module

Create `core/spec/support/sharedExamples/mergeBodyResolverSharedExamples.js`, following the JSDoc-documented style of `issueStateWriteSharedExamples.js` and the callback-abstraction shape of `githubIssueCreateSharedExamples.js`'s `registerGithubIssueCreateSharedExamples`.

Export a single function, e.g. `registerMergeBodyResolverSharedExamples(resolveMergeBody)`, where `resolveMergeBody` is an async callback with signature `({ commits, configValues, modelEmail }) => Promise<{ included: boolean, body: string }>`. The function registers `it`s (no `describe` wrapper — callers nest it inside their own `describe('"coauthors" mode', ...)` etc.) covering every scenario currently duplicated:

- `empty` mode: included empty body (`{ included: true, body: '' }`) — configValues `{ merge_body_mode: 'empty' }`.
- `full` mode: excluded body (`{ included: false, body: '' }`) — configValues `{ merge_body_mode: 'full' }`.
- `coauthors` mode:
  - builds a deduped, email-sorted `Co-authored-by` block from PR commits (bob/alice fixture).
  - dedupes by email, keeping one entry per address.
  - excludes the entry matching the merger's own GitHub login.
  - fails open (skips only the merger exclusion) when the merger-login lookup fails.
  - excludes `modelEmail`'s entry only when `omit_model_coauthor` is true AND `modelEmail` is given.
  - does not exclude `modelEmail`'s entry when `omit_model_coauthor` is not set.
  - excludes any entry whose email is in the `remove_coauthors` config list.
  - falls back to `full` mode's behavior (excluded) when the resulting list is empty.

Each registered `it` builds its own `commits`/`configValues`/`modelEmail` fixture (matching today's per-scenario fixtures in `MergeBodyResolver_spec.js`), calls `await resolveMergeBody({ commits, configValues, modelEmail })`, and asserts on the returned `{ included, body }` — identical expectations to what each file already asserts today, just routed through the callback instead of a direct `resolver.buildBody()` call.

## Files to Change

- `core/spec/support/sharedExamples/mergeBodyResolverSharedExamples.js` — new file; shared example module as described above.
