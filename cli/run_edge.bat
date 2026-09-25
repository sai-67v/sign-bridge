@echo off
cd /d "%~dp0"
set "CLI_DIR=%~dp0"
if "%CLI_DIR:~-1%"=="\" set "CLI_DIR=%CLI_DIR:~0,-1%"

if exist "%CLI_DIR%\canis_env.bat" call "%CLI_DIR%\canis_env.bat"
if not defined CANIS_API_PORT set "CANIS_API_PORT=5000"
if not defined CANIS_TEACH_ADAPTER set "CANIS_TEACH_ADAPTER=teach"

if not exist "%CLI_DIR%\.venv\Scripts\python.exe" (
  echo [ERROR] Run setup first:  setup-canis-edge.ps1
  pause
  exit /b 1
)

echo.
echo  ================================================================
echo    CANIS EDGE — llama-server + pipeline API
echo  ================================================================
echo.
echo    Paste in Studio guest AI sidebar:
echo      http://localhost:%CANIS_API_PORT%
echo.
echo    Live Studio:  https://canis.appwrite.network
echo  ================================================================
echo.

echo [0/2] Syncing GGUF + LoRA into llama dir...
powershell -NoProfile -ExecutionPolicy Bypass -File "%CLI_DIR%\scripts\sync_canis_models_to_llama.ps1"
echo.

where wt >nul 2>&1
if %ERRORLEVEL% equ 0 (
  wt -w 0 new-tab --title "llama-server" -d "%CLI_DIR%" cmd /k "call start_llama_server.bat"
  echo [INFO] Waiting 20s for model load...
  timeout /t 20 /nobreak >nul
  wt -w 0 new-tab --title "Canis pipelines" -d "%CLI_DIR%" cmd /k "call canis_env.bat && .\.venv\Scripts\python.exe -m canis.interfaces.server --host 0.0.0.0 --port %CANIS_API_PORT%"
) else (
  echo [INFO] Windows Terminal not found — start manually in two consoles:
  echo   1^) start_llama_server.bat
  echo   2^) .venv\Scripts\python.exe -m canis.interfaces.server --host 0.0.0.0 --port %CANIS_API_PORT%
  start "llama-server" cmd /k "call start_llama_server.bat"
  timeout /t 20 /nobreak >nul
  start "Canis API" cmd /k "call canis_env.bat && .\.venv\Scripts\python.exe -m canis.interfaces.server --host 0.0.0.0 --port %CANIS_API_PORT%"
)

echo.
echo  Health checks:
echo    curl http://127.0.0.1:8080/health
echo    curl http://localhost:%CANIS_API_PORT%/v1/health
echo    curl http://localhost:%CANIS_API_PORT%/v1/pipelines
echo.
pause
