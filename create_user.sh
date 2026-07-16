#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

if [ -x "$BACKEND_DIR/venv/bin/python" ]; then
  PYTHON_BIN="$BACKEND_DIR/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "❌ Python non trovato."
  exit 1
fi

if [ ! -f "$BACKEND_DIR/create_user.py" ]; then
  echo "❌ File backend/create_user.py non trovato."
  exit 1
fi

cd "$ROOT_DIR"
"$PYTHON_BIN" "$BACKEND_DIR/create_user.py" "$@"
