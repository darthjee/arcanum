# Plan: Codacy: duplication cluster — GithubToken_spec.js internal self-duplication (31 clone groups, 1 file)

Issue: [540-codacy-duplication-cluster-githubtoken-spec-js-internal-self-duplication-31-clone-groups-1-file.md](../issues/540-codacy-duplication-cluster-githubtoken-spec-js-internal-self-duplication-31-clone-groups-1-file.md)

## Overview

Deduplicate `core/spec/lib/utils/github/GithubToken_spec.js` by extracting its repeated `execFileAsync` fake/branch scaffolding into a small helper and collapsing the pure resolve/reject scenarios into a parameterized `it.each` table.

See [node.md](node.md) for the full plan.
