#!/usr/bin/env bash
exec bun "$(dirname "$(readlink -f "$0")")/dist/cli.js" "$@"
