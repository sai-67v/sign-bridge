#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
[ -f "$ROOT/canis_env.sh" ] && source "$ROOT/canis_env.sh"
# shellcheck source=/dev/null
[ -f "$ROOT/canis_env.example.sh" ] && source "$ROOT/canis_env.example.sh"

LLAMA_DIR="${LLAMA_DIR:-$HOME/llama.cpp}"
MODEL_PATH="${MODEL_PATH:-$HOME/canis.edge/models/base.gguf}"
ADAPTERS_DIR="${ADAPTERS_DIR:-$HOME/canis.edge/adapters}"
HOST="${LLAMA_HOST:-127.0.0.1}"
PORT="${LLAMA_PORT:-8080}"
CTX_SIZE="${CTX_SIZE:-4096}"

SERVER="$LLAMA_DIR/llama-server"
[ -x "$SERVER" ] || SERVER="$LLAMA_DIR/build/bin/llama-server"
[ -x "$SERVER" ] || SERVER="$(command -v llama-server 2>/dev/null || true)"

if [ -z "$SERVER" ] || [ ! -x "$SERVER" ]; then
  echo "[ERROR] llama-server not found. Run ./setup-canis-edge.sh -InstallLlama or set LLAMA_DIR."
  exit 1
fi
if [ ! -f "$MODEL_PATH" ]; then
  echo "[ERROR] MODEL_PATH missing: $MODEL_PATH"
  echo "        Place a GGUF base model there or run setup with HF_BASE_GGUF_* set."
  exit 1
fi

LORA_ARGS=()
if [ -d "$ADAPTERS_DIR" ]; then
  LORA_LIST=""
  while IFS= read -r -d '' f; do
    if [ -z "$LORA_LIST" ]; then LORA_LIST="$f"; else LORA_LIST="$LORA_LIST,$f"; fi
  done < <(find "$ADAPTERS_DIR" -name '*.gguf' -print0 2>/dev/null || true)
  if [ -n "$LORA_LIST" ]; then
    LORA_ARGS=(--lora "$LORA_LIST" --lora-init-without-apply)
    echo "[INFO] LoRA: $LORA_LIST"
  fi
fi

echo "[INFO] Starting llama-server on http://${HOST}:${PORT}"
exec "$SERVER" \
  --model "$MODEL_PATH" \
  --host "$HOST" \
  --port "$PORT" \
  --ctx-size "$CTX_SIZE" \
  "${LORA_ARGS[@]}"
