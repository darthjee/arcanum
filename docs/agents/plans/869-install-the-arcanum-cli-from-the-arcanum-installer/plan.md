# Plan: Install the arcanum CLI from the arcanum installer

Issue: [869-install-the-arcanum-cli-from-the-arcanum-installer.md](../../issues/869-install-the-arcanum-cli-from-the-arcanum-installer.md)

## Overview

Make `arcanum/install/installer.sh` run the shared client step (`arcanum/_lib/install_cli.sh`, #868) as its last step, guarded so the arcanum install always exits `0` once complete. Add a test-only TTY seam to the installer, its first standalone test script, and small doc touch-ups.

See [scripter.md](scripter.md) for the full plan.
