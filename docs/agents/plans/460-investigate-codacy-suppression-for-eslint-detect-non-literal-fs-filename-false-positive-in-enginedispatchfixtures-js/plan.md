# Plan: Investigate Codacy suppression for ESLint detect-non-literal-fs-filename false positives across core/spec test fixtures

Issue: [460-investigate-codacy-suppression-for-eslint-detect-non-literal-fs-filename-false-positive-in-enginedispatchfixtures-js.md](../issues/460-investigate-codacy-suppression-for-eslint-detect-non-literal-fs-filename-false-positive-in-enginedispatchfixtures-js.md)

## Overview

Confirm the exact Codacy `detect-non-literal-fs-filename` finding(s), then durably suppress this false-positive class — a non-literal `fs` path built from a trusted, test-controlled directory — for the whole recurring pattern under `core/spec/`, not just `engineDispatchFixtures.js`. Because `eslint-plugin-security` is not installed/configured in this repo's own ESLint setup, suppression must happen on Codacy's side (dashboard/API), not via an inline `// eslint-disable` comment.

See [node.md](node.md) for the full plan.
