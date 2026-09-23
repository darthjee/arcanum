# Plan: Split GitHubClient_spec.js into smaller domain-focused spec files

Issue: [580-split-githubclient-spec-js-into-smaller-domain-focused-spec-files.md](../../issues/580-split-githubclient-spec-js-into-smaller-domain-focused-spec-files.md)

## Overview
Split the 616-line `core/spec/lib/utils/github/GitHubClient_spec.js` into six spec files grouped by domain, each under ~200 lines. The inline `newClient` helper moves into a reusable support factory, and the original file is deleted. Only specs are moved; no test or production behavior changes.

See [node.md](node.md) for the full plan.
