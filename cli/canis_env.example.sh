#!/usr/bin/env bash
# Copy to canis_env.sh and edit for your machine.

export LLAMA_DIR="${LLAMA_DIR:-$HOME/llama.cpp-gemma4}"
export CANIS_MODELS_DIR="${CANIS_MODELS_DIR:-$LLAMA_DIR/canis-models}"
export CANIS_TEACH_GEMMA="${CANIS_TEACH_GEMMA:-$HOME/canis.teach/GEMMA}"
export MODEL_REL="${MODEL_REL:-canis-models/gemma-4-E2B-it-Q4_K_M.gguf}"
export ADAPTERS_DIR="${ADAPTERS_DIR:-$CANIS_MODELS_DIR/lora}"
export LLAMA_PORT="${LLAMA_PORT:-8080}"
export CANIS_API_PORT="${CANIS_API_PORT:-5000}"
export CTX_SIZE="${CTX_SIZE:-8192}"
export N_GPU_LAYERS="${N_GPU_LAYERS:-99}"
export CANIS_TEACH_ADAPTER="${CANIS_TEACH_ADAPTER:-teach}"
export CANIS_DEFAULT_ADAPTER="${CANIS_DEFAULT_ADAPTER:-teach}"
export HF_BASE_GGUF_REPO="${HF_BASE_GGUF_REPO:-unsloth/gemma-4-E2B-it-GGUF}"
export HF_BASE_GGUF_FILE="${HF_BASE_GGUF_FILE:-gemma-4-E2B-it-Q4_K_M.gguf}"
export HF_ADAPTER_REPO="${HF_ADAPTER_REPO:-CanisAI/teach-multilingual-gemma-4-e2b-r3}"
export HF_ADAPTER_GGUF_FILE="${HF_ADAPTER_GGUF_FILE:-teach-multilingual-gemma-4-e2b-r3-Q4_K_M.gguf}"
