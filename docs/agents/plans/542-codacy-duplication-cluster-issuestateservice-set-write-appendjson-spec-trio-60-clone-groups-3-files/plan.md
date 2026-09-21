# Plan: Codacy: duplication cluster — IssueStateService Set/Write/AppendJson spec trio (60 clone groups, 3 files)

Issue: [542-codacy-duplication-cluster-issuestateservice-set-write-appendjson-spec-trio-60-clone-groups-3-files.md](../../issues/542-codacy-duplication-cluster-issuestateservice-set-write-appendjson-spec-trio-60-clone-groups-3-files.md)

## Overview
Extract the duplicated setup preamble and the three repeated assertion patterns (lock acquire/release, concurrent-write safety, merge semantics) shared by `IssueStateServiceSet_spec.js`, `IssueStateServiceWrite_spec.js`, and `IssueStateServiceAppendJson_spec.js` into a new `core/spec/support/sharedExamples/issueStateWriteSharedExamples.js`, following the existing shared-example convention already used by `core/spec/support/sharedExamples/engineDispatchRouting.js`.

See [node.md](node.md) for the full plan.
