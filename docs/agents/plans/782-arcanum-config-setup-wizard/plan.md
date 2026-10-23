# Plan: arcanum config setup wizard

Issue: [782-arcanum-config-setup-wizard.md](../../issues/782-arcanum-config-setup-wizard.md)

## Overview
Add `arcanum config setup [<section>...]`, the interactive onboarding wizard specified in [Shortcuts and Setup → `arcanum config setup` wizard](../../specs/arcanum-cli/shortcuts-and-setup.md#arcanum-config-setup-wizard). It is driven by the registry's `setup` fields and writes through the existing generic `set`/`unset` path. The work is entirely in `cli/` and its docs.

See [client.md](client.md) for the full plan.
