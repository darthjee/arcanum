# Plan: Split spec AutoFixAllConfigParity

Issue: [355-split-spec-autofixallconfigparity.md](../../issues/355-split-spec-autofixallconfigparity.md)

## Overview

Spec-only reorganization of `core/spec/bin/autoFixAllConfigParity_spec.js`: extract its
shared helpers into `core/spec/support/factories/autoFixAllConfigParitySetup.js`, split the
four subcommand `describe` blocks into one file each under a new
`core/spec/bin/autoFixAllConfigParity/` directory, and delete the monolith. Every `it` moves
verbatim; no production code changes.

This is a single-agent (`node`) change. See [node.md](node.md) for the full plan.
