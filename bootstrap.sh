#!/usr/bin/env bash
# KingKaid Linux/macOS bootstrap wrapper
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
    echo "[ERROR] python3 not found on PATH."
    echo ""
    echo "Install Python 3.11 first:"
    if [[ "$(uname)" == "Darwin" ]]; then
        echo "  brew install python@3.11"
    else
        echo "  sudo apt install python3.11 python3.11-venv    # Debian/Ubuntu"
        echo "  sudo dnf install python3.11                    # Fedora/RHEL"
    fi
    exit 1
fi

PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if [[ "$(printf '%s\n' "3.11" "$PY_VER" | sort -V | head -n1)" != "3.11" ]]; then
    echo "[ERROR] Python $PY_VER detected, need >= 3.11"
    exit 1
fi

cd "$(dirname "$0")"
exec python3 scripts/bootstrap.py "$@"
