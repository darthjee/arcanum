# Plan: Codacy: Semgrep dockerfile missing-user — core/Dockerfile (2 findings)

Issue: [604-codacy-semgrep-dockerfile-missing-user-core-dockerfile-2-findings.md](../../issues/604-codacy-semgrep-dockerfile-missing-user-core-dockerfile-2-findings.md)

## Overview
Silence the two false-positive High Semgrep `missing-user` findings on `core/Dockerfile` through Codacy configuration. `.codacy.yml` gets an Opengrep/Semgrep-engine-scoped exclusion, and the Dockerfile loses the broken `# nosemgrep: Semgrep_...` comments added by #494. Runtime behaviour is unchanged.

See [infra.md](infra.md) for the full plan.
