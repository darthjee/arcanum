# Plan: Add the shared arcanum-cli install script

Issue: [868-add-the-shared-arcanum-cli-install-script.md](../../issues/868-add-the-shared-arcanum-cli-install-script.md)

## Overview

Add `arcanum/_lib/install_cli.sh <version> [--no-confirm]`, the plain-bash client step shared by the installer, the updater, `/arcanum-update` and the global migration, with its standalone test script and the spec/architecture touch-ups the issue lists. Callers are wired in #869–#872.

See [scripter.md](scripter.md) for the full plan.
