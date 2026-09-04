# Plan: Split spec AutoFixAllWaitCi

Issue: [361-split-spec-autofixallwaitci.md](../issues/361-split-spec-autofixallwaitci.md)

## Overview

Spec-only reorganization: split the 351-line `AutoFixAllWaitCi_spec.js` into four
scenario-scoped sibling files and extract its shared test fakes into a reusable factory module.
No production code changes.

See [node.md](node.md) for the full plan.
