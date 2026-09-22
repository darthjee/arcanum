# Plan: Codacy: duplication cluster — arcanumUpdateRunUpdateParity check/apply pair (108 clone groups, 2 files)

Issue: [546-codacy-duplication-cluster-arcanumupdaterunupdateparity-check-apply-pair-108-clone-groups-2-files.md](../../issues/546-codacy-duplication-cluster-arcanumupdaterunupdateparity-check-apply-pair-108-clone-groups-2-files.md)

## Overview

Extract the shell/native parity-assertion block repeated 8 times across `core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js` and `apply_spec.js` into a shared example, modeled on the existing `core/spec/support/sharedExamples/cliParityValidation.js` pattern.

See [node.md](node.md) for the full plan.
