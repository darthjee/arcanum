# Plan: Split spec GithubIssue

Issue: [363-split-spec-githubissue.md](../issues/363-split-spec-githubissue.md)

## Overview

Spec-only reorganization of `core/spec/lib/commands/shared/GithubIssue_spec.js` (387 lines)
into three sibling files, one per `GithubIssue` public method, folding each method's
context-injected (CLI flag-on) tests into its own file, plus a new shared factory module for
the `stubDeps`/`loadFixture` helpers. No production code changes.

See [node.md](node.md) for the full plan.
