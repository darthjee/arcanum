# Plan: Migrate the arcanum-split-issue commands to RepoContext

Issue: [310-migrate-the-arcanum-split-issue-commands-to-repocontext.md](../../issues/310-migrate-the-arcanum-split-issue-commands-to-repocontext.md)

## Overview

#308 sub-issue 2. Flip `takesRepoContext: true` for the four `arcanum-split-issue`
commands and change each constructor to `constructor(repoContext, { ...deps } = {})`,
reading `repoPath` via `this._repoContext.repoPath`. Add one write-side passthrough
`RepoContext#appendIssueState` so `ArcanumSplitIssueCreateSubIssue` can drop its
throwaway internal `RepoContext` and five unused test knobs. Output-neutral: the
four `core/spec/bin/arcanumSplitIssue*Parity_spec.js` files must pass unmodified.

See [node.md](node.md) for the full plan.
