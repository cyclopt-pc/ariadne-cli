#!/usr/bin/env sh
set -eu
REPO="${ARIADNE_GITHUB_REPO:-cyclopt-pc/ariadne-cli}"
VERSION="${ARIADNE_VERSION:-latest}"
case "$(uname -s)" in Darwin) platform=darwin ;; Linux) platform=linux ;; *) echo 'Unsupported OS' >&2; exit 1 ;; esac
case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) echo 'Unsupported CPU' >&2; exit 1 ;; esac
asset="ariadne-${platform}-${arch}"
base="https://github.com/${REPO}/releases"
if [ "$VERSION" = latest ]; then base="$base/latest/download"; else base="$base/download/$VERSION"; fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT HUP INT TERM
curl -fLsS "$base/$asset" -o "$work/$asset"
curl -fLsS "$base/SHA256SUMS" -o "$work/SHA256SUMS"
(cd "$work" && grep "  $asset\$" SHA256SUMS | shasum -a 256 -c -) || { echo 'Checksum verification failed' >&2; exit 1; }
dest="${ARIADNE_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$dest"
chmod 755 "$work/$asset"
cp "$work/$asset" "$dest/ariadne"
echo "Installed $dest/ariadne"
echo 'Ensure the install directory is in your PATH.'
