#!/usr/bin/env bash
# Thin wrapper around `npm run smoke` for local/manual use.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run smoke
