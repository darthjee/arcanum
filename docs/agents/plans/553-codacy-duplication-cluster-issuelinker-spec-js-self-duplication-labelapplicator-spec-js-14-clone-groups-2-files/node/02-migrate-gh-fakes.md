# Migrate the gh fakes in the issue specs
Rewrite the local `fakeExecFileAsync({...})` in both issue specs as thin wrappers that call the shared `fakeExecFileAsync('gh', [...routes])`. Keep each option signature and its JSDoc.

- **IssueLinker_spec.js** has three routes:
  - node-id lookup (`issue view` with `id`): throws when `nodeIdFail`, otherwise returns `nodeIds[args[2]]`
  - comment (`issue comment`): picks parent vs. new issue by `args[3].startsWith('Spawned issue #')` and throws on the matching fail flag
  - `api graphql`: throws when `graphqlFail`
- **LabelApplicator_spec.js** has two routes:
  - labels lookup (`issue view` with `labels`): throws when `parentLabelsFail`
  - `issue edit`: throws when `editFail`

Error messages must stay byte-identical, because the specs assert on the warnings built from them.

## Files to Change
- `core/spec/lib/utils/issue/IssueLinker_spec.js` — local fake becomes a route table over the shared helper.
- `core/spec/lib/utils/issue/LabelApplicator_spec.js` — same.
