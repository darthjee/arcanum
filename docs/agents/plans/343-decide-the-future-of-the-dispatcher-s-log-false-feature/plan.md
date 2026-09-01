# Plan: Decide the future of the Dispatcher's log:false feature

Issue: [343-decide-the-future-of-the-dispatcher-s-log-false-feature.md](../../issues/343-decide-the-future-of-the-dispatcher-s-log-false-feature.md)

## Overview

Remove the now-unused `log: false` `CommandEntry` opt-out from the native
dispatcher. After #340 removed `dispatch-fixture` (the only entry that set it)
and all three of its tests, `log: false` is a wired-but-dead extension point:
documented in the `CommandEntry` typedef and implemented as a guard in
`Dispatcher#dispatch()`, with zero users, zero tests, and an uncovered branch.
The change is confined to `core/lib/core/` — a single `node`-agent task.

See [node.md](node.md) for the full plan.
