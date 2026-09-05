# Plan: Split spec PrOperations

Issue: [365-split-spec-properations.md](../issues/365-split-spec-properations.md)

## Overview

Spec-only reorganization: split the 289-line `PrOperations_spec.js` into three method-scoped
sibling files and extract its shared test fakes/builder into a reusable factory module. No
production code changes.

See [node.md](node.md) for the full plan.
