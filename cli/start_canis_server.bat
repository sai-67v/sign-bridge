@echo off
setlocal EnableDelayedExpansion

if exist "%~dp0canis_env.bat" call "%~dp0canis_env.bat"

if not defined LLAMA_DIR set "LLAMA_DIR=%USERPROFILE%\llama.cpp-gemma4"
if not exist "%LLAMA_DIR%\llama-server.exe" (
    if exist "%USERPROFILE%\llama.cpp-gemma4\llama-server.exe" (
        set "LLAMA_DIR=%USERPROFILE%\llama.cpp-gemma4"
        set "CANIS_MODELS_DIR=%LLAMA_DIR%\canis-models"
        set "ADAPTERS_DIR=%CANIS_MODELS_DIR%\lora"
    )
)
if not exist "%LLAMA_DIR%\llama-server.exe" (
    for /f "delims=" %%P in ('where llama-server.exe 2^>nul') do (
        set "LLAMA_DIR=%%~dpP"
        goto :llama_found
    )
)
:llama_found
if defined LLAMA_DIR (
    if "%LLAMA_DIR:~-1%"=="\" set "LLAMA_DIR=%LLAMA_DIR:~0,-1%"
)
if not defined CANIS_MODELS_DIR set "CANIS_MODELS_DIR=%LLAMA_DIR%\canis-models"
if not defined CANIS_TEACH_GEMMA set "CANIS_TEACH_GEMMA=%USERPROFILE%\canis.teach\GEMMA"
if not defined MODEL_REL set "MODEL_REL=canis-models/gemma-4-E2B-it-Q4_K_M.gguf"
if not defined ADAPTERS_DIR set "ADAPTERS_DIR=%CANIS_MODELS_DIR%\lora"

set "HOST=127.0.0.1"
set "PORT=8080"
if not defined CTX_SIZE set "CTX_SIZE=8192"
if not defined N_GPU_LAYERS set "N_GPU_LAYERS=99"
set "BATCH_SIZE=512"
set "UBATCH_SIZE=256"
set "PARALLEL=1"

echo.
echo  ================================================================
echo    CANIS - Gemma 4 llama-server
echo  ================================================================
echo.

if not exist "%LLAMA_DIR%\llama-server.exe" (
    echo [ERROR] llama-server.exe not found in %LLAMA_DIR%
    echo         Run:  .\setup-canis-edge.ps1 -InstallLlama
    echo         Or set LLAMA_DIR in canis_env.bat to your install folder.
    pause
    exit /b 1
)

if not exist "%CANIS_MODELS_DIR%\gemma-4-E2B-it-Q4_K_M.gguf" (
    echo [INFO] Linking models into %CANIS_MODELS_DIR% ...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sync_canis_models_to_llama.ps1"
)

if not exist "%CANIS_MODELS_DIR%\gemma-4-E2B-it-Q4_K_M.gguf" (
    echo [ERROR] Base model missing. See EDGE_SETUP.md and run setup-canis-edge.ps1 -DownloadModels
    pause
    exit /b 1
)

set "LORA_LIST="
set "ADAPTER_COUNT=0"

echo [INFO] Scanning adapters in %ADAPTERS_DIR% ...
for /d %%D in ("%ADAPTERS_DIR%\*") do (
    for %%F in ("%%D\*.gguf") do (
        if exist "%%F" (
            echo        + %%~nxF [%%~nxD]
            set "REL=canis-models/lora/%%~nxD/%%~nxF"
            if "!LORA_LIST!"=="" (
                set "LORA_LIST=!REL!"
            ) else (
                set "LORA_LIST=!LORA_LIST!,!REL!"
            )
            set /a ADAPTER_COUNT+=1
        )
    )
)

set "LORA_ARGS="
if !ADAPTER_COUNT! GTR 0 (
    echo.
    echo [INFO] !ADAPTER_COUNT! adapter^(s^) loaded at scale 0 — TEACH pipeline uses adapter "teach"
    set "LORA_ARGS=--lora !LORA_LIST! --lora-init-without-apply"
) else (
    echo [WARN] No adapters in %ADAPTERS_DIR% — run setup-canis-edge.ps1 -DownloadModels
)

echo.
echo [INFO] Model: %MODEL_REL%
echo [INFO] LLAMA_DIR: %LLAMA_DIR%
echo [INFO] Context: %CTX_SIZE%  GPU layers: %N_GPU_LAYERS%
echo.
cd /d "%LLAMA_DIR%"

llama-server.exe --model "%MODEL_REL%" --host %HOST% --port %PORT% --ctx-size %CTX_SIZE% --batch-size %BATCH_SIZE% --ubatch-size %UBATCH_SIZE% --parallel %PARALLEL% --n-gpu-layers %N_GPU_LAYERS% --jinja --reasoning off %LORA_ARGS%

echo.
echo [INFO] Server stopped.
pause
