# Plan: Reduce cyclomatic complexity of fakeGithubApiFetchPreload.js's github-mode fetch mock (Lizard: 20 vs limit 15)

Issue: [462-reduce-cyclomatic-complexity-of-fakegithubapifetchpreload-js-s-github-mode-fetch-mock-lizard-20-vs-limit-15.md](../issues/462-reduce-cyclomatic-complexity-of-fakegithubapifetchpreload-js-s-github-mode-fetch-mock-lizard-20-vs-limit-15.md)

## Overview

`core/spec/support/utils/fakeGithubApiFetchPreload.js`'s `github`-mode fetch mock is a
single async arrow function with a long `if`/`else if` chain, reported at cyclomatic
complexity 20 against the repo's limit of 15. This plan replaces that chain with an
ordered array of `{ match, handler }` entries — modeled on the existing
`fakeExecFileAsync(handlers)` precedent in `arcanumUpdateRunUpdate.js` — evaluated via
`.find()`, with zero change to any observable response, status code, or routing
decision. Scope is limited to `github` mode; no other mode in this file exceeds the
limit.

See [node.md](node.md) for the full plan.
