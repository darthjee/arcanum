# Plan: Investigate Codacy suppression for XSS false positive in fakeGithubApiFetchPreload.js

Issue: [461_investigate-codacy-suppression-for-eslint-xss-no-mixed-html-false-positive-in-fakegithubapifetchpreload-js.md](../issues/461-investigate-codacy-suppression-for-eslint-xss-no-mixed-html-false-positive-in-fakegithubapifetchpreload-js.md)

## Overview

Suppress the two currently-open Codacy SRM findings ("Unencoded input 'prUrl' used in HTML context", category XSS, priority High) against `core/spec/support/utils/fakeGithubApiFetchPreload.js`. Both are false positives: `prUrl` is always a test-fixture string read from an env var, never rendered as HTML or assigned to the DOM. The fix is Codacy-side (mark both findings "Ignored") plus an in-code comment for future contributors, mirroring the precedent set by issue #460.

See [node.md](node.md) for the full plan.
