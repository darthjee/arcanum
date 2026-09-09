# Plan: Extend ClaudeContext to carry the runtime-validated arcanum install root

Issue: [419-extend-claudecontext-to-carry-the-config-dir-validated-arcanum-install-root.md](../issues/419-extend-claudecontext-to-carry-the-config-dir-validated-arcanum-install-root.md)

## Overview

Extend `core/lib/context/ClaudeContext.js` in place with arcanum-install-root
accessors and one lazy `fs` validator (`validateInstall()`) that asserts the anchor
it was handed is the arcanum install this runtime executes from
(`realpath(anchor) === INSTALL_ROOT`), plus the existing `STATUS=missing_arcanum`
structural marker check. Fully backward compatible for `permission-grant-add`; all
consumer wiring is out of scope (issue #420).

See [node.md](node.md) for the full plan.
