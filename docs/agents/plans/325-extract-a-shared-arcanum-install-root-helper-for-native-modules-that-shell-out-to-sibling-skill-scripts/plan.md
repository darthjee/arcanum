# Plan: Extract a shared arcanum-install-root helper for native modules that shell out to sibling skill scripts

Issue: [325-extract-a-shared-arcanum-install-root-helper-for-native-modules-that-shell-out-to-sibling-skill-scripts.md](../../issues/325-extract-a-shared-arcanum-install-root-helper-for-native-modules-that-shell-out-to-sibling-skill-scripts.md)

## Overview

Add a single `core/lib/utils/file/InstallRoot.js` helper that computes the arcanum install root once, from its own fixed module location, and exposes `resolveInstallPath(...segments)` plus the bare `INSTALL_ROOT` constant. Route every install-root-relative lookup in `core/lib/` through it, replacing the inline `path.join(MODULE_DIR, '..', '..', '..', …)` walks in `ArcanumSplitIssueFinish.js`, `AutoFixAllReplyComment.js`, and `core/lib/core/dispatcher.js`, and fixing `AutoFixAllReplyComment`'s `reply.tmpl.md` lookup, which currently resolves against the target `repoContext.repoPath` instead of the install root.

All work is within the `node` agent's scope (`core/lib/`, `core/spec/`). See [node.md](node.md) for the full plan.
