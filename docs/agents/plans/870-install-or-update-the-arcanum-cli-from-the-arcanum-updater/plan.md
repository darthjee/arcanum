# Plan: Install or update the arcanum CLI from the arcanum updater

Issue: [870-install-or-update-the-arcanum-cli-from-the-arcanum-updater.md](../../issues/870-install-or-update-the-arcanum-cli-from-the-arcanum-updater.md)

## Overview

Run the shared client step (`arcanum/_lib/install_cli.sh`) at the end of both update paths: the zip updater (`arcanum/update/updater.sh`) and the git branch of `arcanum/update/bootstrap.sh`. Ignore every client outcome except exit `4`, which is propagated. Add standalone tests for both paths and touch up the spec. All of it is `scripter` work.

See [scripter.md](scripter.md) for the full plan.
