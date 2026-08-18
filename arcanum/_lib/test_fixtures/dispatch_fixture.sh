#!/usr/bin/env bash
# Throwaway shell-side fixture standing in for "the existing shell
# implementation" of a migrated entrypoint, used to prove
# arcanum/_lib/engine_dispatch.sh's shell/native dispatch works — see
# arcanum/_lib/test_engine_dispatch.sh and
# docs/agents/architecture/script-engine.md.
#
# Its stdout is part of a fixed shared contract with core/bin/arcanum's
# "dispatch-fixture" native module (see docs/agents/plans/192-.../plan.md):
# both sides must print this exact line and exit 0. Do not change this
# output without coordinating with the native fixture module.
#
# Usage: bash arcanum/_lib/test_fixtures/dispatch_fixture.sh  (no arguments)

set -uo pipefail

echo "dispatch-fixture: ok"
exit 0
