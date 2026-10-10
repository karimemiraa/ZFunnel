#!/usr/bin/env bash
# Fast local gate before committing: format, licenses, lint, typecheck, unit tests.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm -s format
pnpm -s check:licenses
pnpm -s lint --output-logs=errors-only
pnpm -s typecheck --output-logs=errors-only
pnpm -s test --output-logs=errors-only
echo "✓ verify passed"
