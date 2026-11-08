# Plan: Add a per-tier view and an interactive editor to `arcanum config agents email`

Issue: [898-add-a-per-tier-view-and-an-interactive-editor-to-arcanum-config-agents-email.md](../../issues/898-add-a-per-tier-view-and-an-interactive-editor-to-arcanum-config-agents-email.md)

## Overview
Extend the existing `arcanum config agents email` shortcut with a per-tier matrix (`--all-tiers`) of every agent × local/repo/global, and an interactive `edit` verb to set/unset agent emails from that matrix. All work is in `cli/` and its docs, owned by the `client` agent.

See [client.md](client.md) for the full plan.
