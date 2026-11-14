# Plan: Add a config doctor that lists values in disallowed tiers and unknown keys

Issue: [914-add-a-config-doctor-that-lists-values-in-disallowed-tiers-and-unknown-keys.md](../../issues/914-add-a-config-doctor-that-lists-values-in-disallowed-tiers-and-unknown-keys.md)

## Overview
Add a read-only `arcanum config doctor` subcommand to the CLI. It scans every tier and reports values in a disallowed tier, unknown keys, and invalid values, each with a hint command to fix it. It exits `0`, `3` or `7`. All of the work is in the `client` agent's scope (`cli/` plus its docs).

See [client.md](client.md) for the full plan.
