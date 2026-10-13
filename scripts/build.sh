#!/usr/bin/env bash
set -euo pipefail
command -v bun >/dev/null || { echo 'Bun is required to build; end users do not need it.' >&2; exit 1; }
VERSION="${ARIADNE_CLI_VERSION:-0.1.0-dev}"
mkdir -p dist
for target in bun-darwin-arm64 bun-darwin-x64 bun-linux-x64 bun-linux-arm64 bun-windows-x64; do
  suffix="${target#bun-}"
  name="ariadne-${suffix}"
  [[ "$target" == bun-windows-* ]] && name="$name.exe"
  echo "Building $name"
  ARIADNE_CLI_VERSION="$VERSION" bun build ./bin/ariadne.mjs --compile --target="$target" --define "process.env.ARIADNE_CLI_VERSION=\"$VERSION\"" --outfile "dist/$name"
done
(cd dist && shasum -a 256 ariadne-* > SHA256SUMS)
