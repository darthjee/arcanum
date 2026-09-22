# Plan: Codacy: duplication cluster — Origin_spec.js self-duplication + SafeBranch_spec.js (17 clone groups, 2 files)

Issue: [550-codacy-duplication-cluster-origin-spec-js-self-duplication-safebranch-spec-js-17-clone-groups-2-files.md](../issues/550-codacy-duplication-cluster-origin-spec-js-self-duplication-safebranch-spec-js-17-clone-groups-2-files.md)

## Overview

This is a `core/spec/` test-only de-duplication, entirely within the `node` agent's scope: parameterize `Origin_spec.js`'s repeated remote-URL-format assertions with `it.each`, dedupe its `repoPath`-fallback/`repoPath`-override pairs across `#resolve`/`#resolveWithRef`, and factor out the `execFileAsync` call-tracking spy fragment it shares with `SafeBranch_spec.js` into a reusable spec support helper.

See [node.md](node.md) for the full plan.
