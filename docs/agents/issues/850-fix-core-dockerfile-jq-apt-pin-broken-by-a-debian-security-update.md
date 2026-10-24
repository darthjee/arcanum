# Issue: Fix core/Dockerfile jq apt pin broken by a Debian security update

## Description

The latest release failed on the CircleCI `publish-image` job, at the **Build and push the multi-arch runtime image** step, while building the `base` stage of `core/Dockerfile`:

```
The following packages have unmet dependencies:
 jq : Depends: libjq1 (= 1.6-2.1+deb12u2) but 1.6-2.1+deb12u3 is to be installed
E: Unable to correct problems, you have held broken packages.
------
Dockerfile:51
  51 | >>> RUN apt-get update \
  52 | >>>     && apt-get install -y --no-install-recommends \
  53 | >>>         jq=1.6-2.1+deb12u2 \
  54 | >>>         git=1:2.39.5-0+deb12u3 \
  55 | >>>         openssh-client=1:9.2p1-2+deb12u10 \
  56 | >>>         libnss-wrapper=1.1.12-1 \
ERROR: failed to build: ... exit code: 100
```

## Problem

`core/Dockerfile` pins every apt package to an exact Debian version for reproducible builds. Debian's `bookworm-security` published `1.6-2.1+deb12u3` of `jq`/`libjq1`; apt now resolves the unpinned dependency `libjq1` to `deb12u3`, which conflicts with the pinned `jq=1.6-2.1+deb12u2` (the `jq` package requires the exact matching `libjq1`). Debian mirrors only keep the latest version of a package in a suite, so the old pin can no longer be satisfied.

The same failure mode can hit the other pins (`git`, `openssh-client`, `libnss-wrapper`) whenever Debian ships a security update for them, and it is only discovered at release time: no job in the `test` workflow builds `core/Dockerfile`.

## Expected Behavior

- `core/Dockerfile` builds again (both `test` and `runtime` targets, amd64 and arm64).
- A Debian security update to a pinned package no longer breaks the build; only a real upstream version change does.

## Solution

Keep pinning the upstream version, but let the Debian security revision float:

```dockerfile
jq=1.6-2.1+deb12u* \
git=1:2.39.5-0+deb12u* \
openssh-client=1:9.2p1-2+deb12u* \
libnss-wrapper=1.1.12-1 \
```

- `jq` therefore resolves to the current `deb12u3` (with its matching `libjq1`), which fixes the build.
- Only the `+deb12uN` suffix is wildcarded; the upstream version stays fixed, so the build still breaks loudly on a real upstream version change (e.g. a base-image Debian release bump).
- `libnss-wrapper` has no `+deb12u` revision today; keep it exact.
- Hadolint DL3008 is still satisfied (it only requires `pkg=<version>`).
- Update the pin comments in `core/Dockerfile` and the **Version pins** section of `docs/agents/architecture/docker-engine.md` to describe the new convention (upstream version pinned, Debian security revision floating) and why.

### Verification

Build locally: `make docker-parity` (builds the `runtime` image and runs the parity specs) and `make core-smoke-runtime`; for the `test` target, `docker compose -f core/docker-compose.yml build` then `make core-test`. CI does not build `core/Dockerfile` on PRs.

### Out of scope

- **Releasing:** re-running the failed `publish-image` job cannot fix it — the job checks out the release tag, so it rebuilds the old Dockerfile. The image ships with the next release, cut as usual after this merges; this issue does not bump the version.
- **Building the image in the `test` workflow:** tracked in #851.

### Alternatives considered

- **Keep exact pins, bump by hand** — fully reproducible, but every Debian security update to any pinned package breaks the build, discovered only at release time (as here). Rejected.
- **`snapshot.debian.org`** — fully reproducible, but freezes out security fixes and makes builds slower and flakier. Rejected.
- **Scheduled CI job that detects stale pins** — only useful alongside exact pins. Not pursued.

## Benefits

- Unblocks publishing the runtime image.
- Security patches for the pinned packages reach the image automatically on the next release, instead of breaking it.
