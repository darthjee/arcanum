# Codacy: duplication cluster — IssueStateService Set/Write/AppendJson spec trio (60 clone groups, 3 files)

## Context

Three specs testing thin variants of the same underlying state-write path share duplicated blocks:

- `core/spec/lib/services/IssueStateServiceSet_spec.js`
- `core/spec/lib/services/IssueStateServiceWrite_spec.js`
- `core/spec/lib/services/IssueStateServiceAppendJson_spec.js`

They share an identical 13-14 line `describe`/setup preamble (lines 8-21) and a repeated "file write + lock release" assertion block (roughly lines 41-64). Codacy reports 60 clone groups and roughly 120 duplicated lines across the trio.

## What needs to be done

- Pull the common state-file fixture and the write/lock assertion into a shared `issueStateWriteSharedExamples.js` file.
- Parameterize the shared examples by the specific mutation (set/write/appendJson) and have all three specs include them.

## Acceptance criteria

- [ ] A shared `issueStateWriteSharedExamples.js` (or equivalent) exists under `core/spec/support` and is used by all three specs.
- [ ] The duplicated setup preamble and write/lock assertion blocks are removed from each file in favor of the shared examples.
- [ ] All three specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this trio drops substantially after the fix lands.
