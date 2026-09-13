# Plan: Harden core/Dockerfile: pin apt-get install package versions (jq)

Issue: [459-harden-core-dockerfile-pin-apt-get-install-package-versions-jq.md](../issues/459-harden-core-dockerfile-pin-apt-get-install-package-versions-jq.md)

## Overview

Pin the `jq` package installed in `core/Dockerfile` to an explicit, known-good version (`jq=1.6-2.1+deb12u2`, matching the `darthjee/node:0.2.1` base image's Debian bookworm repos) instead of floating on whatever version `apt-get` resolves at build time, and document how to refresh that pin in the future.

See [infra.md](infra.md) for the full plan.
