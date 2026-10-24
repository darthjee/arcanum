# Infra Plan: Fix core/Dockerfile jq apt pin broken by a Debian security update

Main plan: [plan.md](plan.md)

## Overview
The `base` stage of `core/Dockerfile` pins `jq=1.6-2.1+deb12u2`, which Debian's mirrors no longer serve since `bookworm-security` published `1.6-2.1+deb12u3` (`jq` needs the exactly matching `libjq1`). Keep the upstream version pinned but let the Debian security revision float, for every pin that carries one.

## Context
- Failing step: CircleCI `release` workflow → `publish-image` → `scripts/publish_runtime_image.sh`, building `core/Dockerfile` (`base` stage, `RUN apt-get update && apt-get install ...` at line 51).
- No `test`-workflow job builds `core/Dockerfile` (follow-up: #851), so verification is local.
- Releasing (a new version tag so `publish-image` runs again) is out of scope.

## Implementation Steps

### Step 1 — Float the Debian security revision in `core/Dockerfile`
In the `base` stage `apt-get install` list, change:

```dockerfile
"jq=1.6-2.1+deb12u*" \
"git=1:2.39.5-0+deb12u*" \
"openssh-client=1:9.2p1-2+deb12u*" \
libnss-wrapper=1.1.12-1 \
```

- Quote the wildcard pins so bash (the stage's `SHELL`) never glob-expands them against files in the working directory; apt matches the `*` itself.
- `libnss-wrapper=1.1.12-1` has no `+deb12u` revision: leave it exact.
- Rewrite the comment block above the `RUN` (the "Every apt package is pinned for reproducible builds ..." paragraph): pins fix the upstream version; the `+deb12u<N>` Debian security revision is wildcarded because Debian mirrors only keep the latest revision of a suite, so an exact revision pin breaks the build as soon as a security update ships (link #850). Keep the `apt-cache policy` refresh command, now used to find the upstream version when the base image moves to a new Debian release.
- Update the header's `FROM` comment ("then re-check every apt pin below against it") only if needed to stay accurate.

### Step 2 — Document the convention in `docs/agents/architecture/docker-engine.md`
In the **Version pins** section:
- Replace "Every input is pinned, following the `jq` convention in `core/Dockerfile`: an exact version string ..." so it no longer claims every input is an exact version.
- Change the **apt packages** bullet: `pkg=<upstream>+deb12u*` for packages with a Debian security revision (`jq`, `git`, `openssh-client`), exact `pkg=<version>` otherwise (`libnss-wrapper`), with `--no-install-recommends`; one sentence on why (security updates replace the old revision on the mirrors).
- Leave the base-image and `gh` bullets unchanged (those stay exact).

(`docs/agents/` is architect-owned; this is a small doc edit that travels with the Dockerfile change.)

## Files to Change
- `core/Dockerfile` — wildcard the `+deb12u` revision of the `jq`, `git` and `openssh-client` pins; rewrite the pin comment.
- `docs/agents/architecture/docker-engine.md` — **Version pins** section describes the new apt pin convention.

## CI Checks
No CI job builds `core/Dockerfile` on branches (only the release-only `publish-image` does). Verify locally:
- `make core-build-runtime` and `make core-smoke-runtime` — builds the `runtime` target and smoke-checks it.
- `make docker-parity` — runs the parity specs against the runtime image.
- `docker compose -f core/docker-compose.yml build` then `make core-test` — rebuilds and runs the `test` target.
- `checks` CI job — Codacy/hadolint still accept the pins (DL3008 only requires `pkg=<version>`).

## Notes
- If `make core-build-runtime` reveals that another pin's upstream version is no longer served (not just the revision), bump that upstream version to the current `apt-cache policy` candidate.
- arm64 is built by `publish-image` via QEMU; Debian ships the same versions for amd64 and arm64, so the local amd64 build is representative.
