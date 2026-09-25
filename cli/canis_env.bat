@echo off
REM Default edge paths — re-run setup-canis-edge.ps1 to regenerate after moving llama.cpp

set "LLAMA_DIR=%USERPROFILE%\llama.cpp-gemma4"
set "CANIS_MODELS_DIR=%LLAMA_DIR%\canis-models"
set "CANIS_TEACH_GEMMA=%USERPROFILE%\canis.teach\GEMMA"
set "MODEL_REL=canis-models/gemma-4-E2B-it-Q4_K_M.gguf"
set "ADAPTERS_DIR=%CANIS_MODELS_DIR%\lora"
set "CANIS_TEACH_ADAPTER=teach"
set "CANIS_DEFAULT_ADAPTER=teach"
set "CTX_SIZE=8192"
set "N_GPU_LAYERS=99"
set "CANIS_API_PORT=5000"
set "HF_BASE_GGUF_REPO=unsloth/gemma-4-E2B-it-GGUF"
set "HF_BASE_GGUF_FILE=gemma-4-E2B-it-Q4_K_M.gguf"
set "HF_ADAPTER_REPO=CanisAI/teach-multilingual-gemma-4-e2b-r3"
set "HF_ADAPTER_GGUF_FILE=teach-multilingual-gemma-4-e2b-r3-Q4_K_M.gguf"
