# Plan: arcanum-split-issue finish (native mode) spawns github.sh with wrong relative path

Issue: [319-arcanum-split-issue-finish-native-mode-spawns-github-sh-with-wrong-relative-path.md](../../issues/319-arcanum-split-issue-finish-native-mode-spawns-github-sh-with-wrong-relative-path.md)

## Overview

`core/lib/commands/ArcanumSplitIssueFinish.js` resolves the `github.sh` helper against the target repo instead of the arcanum install directory, so the native `arcanum-split-issue-finish` entrypoint throws `ENOENT`. Fix it to resolve from the module's own directory (mirroring `AutoFixAllReplyComment.js`), and correct the two specs that currently encode/mask the bug. All work is within `core/`.

See [node.md](node.md) for the full plan.
