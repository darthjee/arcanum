# Plan: Split spec AutoFixAllGithub

Issue: [347-split-spec-autofixallgithub.md](../../issues/347-split-spec-autofixallgithub.md)

## Overview

Spec-only reorganization: break the 456-line
`core/spec/lib/commands/auto-fix-all/AutoFixAllGithub_spec.js` into three focused sibling
spec files split along the delegate each subcommand routes through, and lift its three inline
test fakes into one shared support-factory module. No production code, assertions, or
coverage change.

See [node.md](node.md) for the full plan.
