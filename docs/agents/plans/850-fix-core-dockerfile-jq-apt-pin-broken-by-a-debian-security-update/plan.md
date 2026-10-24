# Plan: Fix core/Dockerfile jq apt pin broken by a Debian security update

Issue: [850-fix-core-dockerfile-jq-apt-pin-broken-by-a-debian-security-update.md](../../issues/850-fix-core-dockerfile-jq-apt-pin-broken-by-a-debian-security-update.md)

## Overview
Switch the Debian-revisioned apt pins in `core/Dockerfile` from exact versions to `<upstream>+deb12u*`, so Debian security updates no longer break the image build, and document the new pin convention.

See [infra.md](infra.md) for the full plan.
