# Plan: Codacy: verify unencoded prUrl in HTML context in fakeGithubApiFetchPreload.js (XSS, 2 findings)

Issue: [495-codacy-verify-unencoded-prurl-in-html-context-in-fakegithubapifetchpreload-js-xss-2-findings.md](../issues/495-codacy-verify-unencoded-prurl-in-html-context-in-fakegithubapifetchpreload-js-xss-2-findings.md)

## Overview

Issue #461 already confirmed these exact two Codacy XSS findings in `core/spec/support/utils/fakeGithubApiFetchPreload.js` are false positives and documented that in code comments, but never achieved a functional suppression — so Codacy re-flagged the same findings as this new issue. This plan attempts a real suppression via the now-available Codacy MCP tools, falling back to documenting the recurrence as expected if no such capability exists.

See [node.md](node.md) for the full plan.
