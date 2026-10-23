# Plan: arcanum config shortcuts

Issue: [781-arcanum-config-shortcuts.md](../../issues/781-arcanum-config-shortcuts.md)

## Overview
Add the curated `arcanum config` shortcuts from `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` as thin front-ends over the #780 generic layer, all in `cli/`. Two pieces add behaviour of their own: the `agents email` resolution view, and the `ignore-checks` array editing, which is atomic through #841's `RepoConfigWriter#update`. The `setup` wizard is #782.

See [client.md](client.md) for the full plan.
