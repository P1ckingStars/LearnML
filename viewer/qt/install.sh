#!/usr/bin/env bash
set -euo pipefail

PREFIX="${1:-/usr/local}"
BIN_DIR="$PREFIX/bin"

# Locate the built binary relative to this script's runfiles
VIEWER="$(dirname "$0")/viewer"
if [[ ! -x "$VIEWER" ]]; then
    echo "Error: viewer binary not found at $VIEWER" >&2
    echo "Run: bazel build //viewer/qt:viewer first" >&2
    exit 1
fi

echo "Installing mdbook-viewer to $BIN_DIR"
install -Dm755 "$VIEWER" "$BIN_DIR/mdbook-viewer"
echo "Done. Run: mdbook-viewer <content-directory>"
