# Plan: Harden core/Dockerfile: add non-root USER directive

Issue: [458-harden-core-dockerfile-add-non-root-user-directive.md](../issues/458-harden-core-dockerfile-add-non-root-user-directive.md)

## Overview

`core/Dockerfile` builds and runs everything as root. This plan switches it to run as the base image's existing non-root `node` user (uid 1000/gid 1000), via a small entrypoint that fixes up ownership of the `core_node_modules` named volume (which Docker creates root-owned, since that path doesn't pre-exist in the image) before dropping privileges.

See [infra.md](infra.md) for the full plan.
