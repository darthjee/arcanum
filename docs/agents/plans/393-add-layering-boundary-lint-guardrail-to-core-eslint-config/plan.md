# Plan: Add layering-boundary lint guardrail to core/eslint config

Issue: [393-add-layering-boundary-lint-guardrail-to-core-eslint-config.md](../../issues/393-add-layering-boundary-lint-guardrail-to-core-eslint-config.md)

## Overview

Enforce `core/lib/`'s documented one-way layering (`commands → context/services → utils`) via ESLint instead of convention only, fixing the one real reverse-layering violation this uncovers along the way.

See [node.md](node.md) for the full plan.
