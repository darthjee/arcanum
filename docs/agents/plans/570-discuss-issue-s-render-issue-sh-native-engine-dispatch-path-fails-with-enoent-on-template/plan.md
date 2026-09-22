# Plan: discuss-issue's render_issue.sh (native engine_dispatch path) fails with ENOENT on template

Issue: [570-discuss-issue-s-render-issue-sh-native-engine-dispatch-path-fails-with-enoent-on-template.md](../../issues/570-discuss-issue-s-render-issue-sh-native-engine-dispatch-path-fails-with-enoent-on-template.md)

## Overview

Fix `DiscussIssueRenderIssue.js` so it resolves `discuss-issue/templates/issue.tmpl.md` relative to the arcanum install (via the existing `resolveInstallPath` helper) instead of relative to the target repo's `repoPath`, and correct the two specs that currently mask this bug by faking a template at the buggy `repoPath`-relative location.

See [node.md](node.md) for the full plan.
