# Plan: Codacy: duplication cluster — DispatchFailure rejection-assertion boilerplate across spec suite (17 files, 30 occurrences)

Issue: [543-codacy-duplication-cluster-label-tag-mutation-assertion-block-58-clone-groups-5-files.md](../../issues/543-codacy-duplication-cluster-label-tag-mutation-assertion-block-58-clone-groups-5-files.md)

## Overview

Extract the duplicated `let thrown; try { await X; } catch (error) { thrown = error; }` rejection-capture boilerplate — repeated 30 times across 17 spec files under `core/spec/` — into a single shared `captureRejection(promise)` utility, and update every call site to use it.

See [node.md](node.md) for the full plan.
