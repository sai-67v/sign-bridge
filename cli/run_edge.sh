#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
[ -f "$ROOT/canis_env.sh" ] && source "$ROOT/canis_env.sh"
# shellcheck source=/dev/null
[ -f "$ROOT/canis_env.example.sh" ] && source "$ROOT/canis_env.example.sh"

CANIS_API_PORT="${CANIS_API_PORT:-5000}"

if [ ! -x "$ROOT/.venv/bin/python" ]; then
  echo "[ERROR] Run ./setup-canis-edge.sh first"
  exit 1
fi

echo ""
echo "================================================================"
echo "  CANIS EDGE — llama-server + pipeline API"
echo "================================================================"
echo "  Paste in Studio guest AI sidebar:"
echo "    http://localhost:${CANIS_API_PORT}"
echo "  Live Studio: https://canis.appwrite.network"
echo "================================================================"
echo ""

if command -v tmux >/dev/null 2>&1; then
  tmux new-session -d -s canis-edge "cd '$ROOT' && ./start_llama_server.sh"
  sleep 20
  tmux split-window -h "cd '$ROOT' && . .venv/bin/activate && python -m canis.interfaces.server --host 0.0.0.0 --port ${CANIS_API_PORT}"
  tmux attach -t canis-edge
else
  echo "[INFO] Start in two terminals:"
  echo "  1) ./start_llama_server.sh"
  echo "  2) source .venv/bin/activate && python -m canis.interfaces.server --host 0.0.0.0 --port ${CANIS_API_PORT}"
fi
