# Plan: Extract IssueClient from IssueTagger/GithubIssue/AutoFixAllReplyComment

Issue: [301-extract-issueclient-from-issuetagger-githubissue-autofixallreplycomment.md](../../issues/301-extract-issueclient-from-issuetagger-githubissue-autofixallreplycomment.md)

## Overview

Centralize the raw `fetch`-to-`api.github.com` calls duplicated across `IssueTagger`, `GithubIssue`, and `AutoFixAllReplyComment` into a new `IssueClient`, mirroring the existing `GitHubClient`/`PrOperations` split. All affected code lives under `core/`, so this is entirely `node`'s work.

See [node.md](node.md) for the full plan.
