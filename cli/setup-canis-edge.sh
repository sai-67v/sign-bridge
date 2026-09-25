#!/usr/bin/env bash
# One-time setup: llama.cpp (optional), Python venv, Canis CLI, model folders.
set -euo pipefail

INSTALL_LLAMA=0
DOWNLOAD_MODELS=0
for arg in "$@"; do
  case "$arg" in
    -InstallLlama|--install-llama) INSTALL_LLAMA=1 ;;
    -DownloadModels|--download-models) DOWNLOAD_MODELS=1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
[ -f "$ROOT/canis_env.sh" ] && source "$ROOT/canis_env.sh"
# shellcheck source=/dev/null
[ -f "$ROOT/canis_env.example.sh" ] && source "$ROOT/canis_env.example.sh"

LLAMA_DIR="${LLAMA_DIR:-$HOME/llama.cpp}"
CANIS_EDGE_ROOT="${CANIS_EDGE_ROOT:-$HOME/canis.edge}"
MODEL_PATH="${MODEL_PATH:-$CANIS_EDGE_ROOT/models/base.gguf}"
ADAPTERS_DIR="${ADAPTERS_DIR:-$CANIS_EDGE_ROOT/adapters}"

echo ""
echo "================================================================"
echo "  Canis Edge Setup (Linux)"
echo "================================================================"
echo ""

install_llama() {
  if [ -x "$LLAMA_DIR/llama-server" ] || [ -x "$LLAMA_DIR/build/bin/llama-server" ]; then
    echo "[OK] llama-server already under $LLAMA_DIR"
    return
  fi
  echo "[1/3] Downloading latest llama.cpp Linux CPU binary..."
  mkdir -p "$LLAMA_DIR"
  json="$(curl -fsSL https://api.github.com/repos/ggml-org/llama.cpp/releases/latest)"
  url="$(echo "$json" | grep -oE 'https://[^"]+bin-linux[^"]*x64[^"]*\.zip' | head -1)"
  if [ -z "$url" ]; then
    url="$(echo "$json" | grep -oE 'https://[^"]+bin-linux[^"]+\.zip' | head -1)"
  fi
  if [ -z "$url" ]; then
    echo "[ERROR] Could not find Linux zip in latest release. Install manually — see EDGE_SETUP.md"
    exit 1
  fi
  tmp="$(mktemp -d)"
  curl -fsSL "$url" -o "$tmp/llama.zip"
  unzip -q "$tmp/llama.zip" -d "$LLAMA_DIR"
  rm -rf "$tmp"
  bin="$(find "$LLAMA_DIR" -name llama-server -type f 2>/dev/null | head -1)"
  if [ -n "$bin" ] && [ "$bin" != "$LLAMA_DIR/llama-server" ]; then
    cp "$bin" "$LLAMA_DIR/llama-server"
    chmod +x "$LLAMA_DIR/llama-server"
  fi
  if [ ! -x "$LLAMA_DIR/llama-server" ]; then
    echo "[ERROR] llama-server not found after extract."
    exit 1
  fi
  echo "[OK] llama-server -> $LLAMA_DIR/llama-server"
  echo "     NVIDIA GPU: download cuda build from https://github.com/ggml-org/llama.cpp/releases"
}

if [ "$INSTALL_LLAMA" -eq 1 ]; then
  install_llama
else
  echo "[SKIP] llama install (use --install-llama or see EDGE_SETUP.md)"
fi

mkdir -p "$(dirname "$MODEL_PATH")" "$ADAPTERS_DIR"
echo "[OK] Data dirs: $CANIS_EDGE_ROOT"

echo "[2/3] Python venv + Canis CLI..."
if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 not found"
  exit 1
fi
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -e .
[ -f ./canis/requirements.txt ] && pip install -q -r ./canis/requirements.txt

if [ "$DOWNLOAD_MODELS" -eq 1 ]; then
  echo "[3/3] Hugging Face downloads..."
  if ! command -v hf >/dev/null 2>&1; then
    pip install -q huggingface_hub
  fi
  if [ -n "${HF_BASE_GGUF_REPO:-}" ] && [ -n "${HF_BASE_GGUF_FILE:-}" ]; then
    dest="$(dirname "$MODEL_PATH")"
    hf download "$HF_BASE_GGUF_REPO" "$HF_BASE_GGUF_FILE" --local-dir "$dest"
    src="$dest/$HF_BASE_GGUF_FILE"
    [ -f "$src" ] && [ "$src" != "$MODEL_PATH" ] && cp "$src" "$MODEL_PATH"
  else
    echo "      Set HF_BASE_GGUF_REPO + HF_BASE_GGUF_FILE in canis_env.sh for base GGUF."
  fi
  if [ -n "${HF_ADAPTER_REPO:-}" ]; then
    mkdir -p "$ADAPTERS_DIR/canis-r3"
    hf download "$HF_ADAPTER_REPO" --local-dir "$ADAPTERS_DIR/canis-r3"
    echo "      Convert safetensors to GGUF if needed — docs/Canis_LoRA_Adapter_Guide.md"
  fi
else
  echo "[SKIP] model download (use --download-models)"
fi

echo ""
echo "================================================================"
echo "  Next: place base GGUF at:  $MODEL_PATH"
echo "  LoRA GGUF under:          $ADAPTERS_DIR"
echo "  Run:                      ./run_edge.sh"
echo "  Studio URL:               http://localhost:${CANIS_API_PORT:-5000}"
echo "  Live demo:                https://canis.appwrite.network"
echo "================================================================"
