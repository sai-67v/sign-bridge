@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
REM Directory without trailing backslash (wt -d misparses with trailing \)
set "CLI_DIR=%~dp0"
if "%CLI_DIR:~-1%"=="\" set "CLI_DIR=%CLI_DIR:~0,-1%"

if exist "%CLI_DIR%\.venv\Scripts\python.exe" (
    set "PY=%CLI_DIR%\.venv\Scripts\python.exe"
) else (
    set "PY=python"
)

echo.
echo  ================================================================
echo    CANIS DEV - Gemma4good complete setup
echo  ================================================================
echo.

where wt >nul 2>&1
if !errorlevel! equ 0 (
    set "USE_WT=1"
) else (
    set "USE_WT=0"
    echo [WARN] Windows Terminal ^(wt^) not found - using separate console windows.
    echo.
)

echo [0/4] Syncing models into llama.cpp (relative paths for LoRA)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%CLI_DIR%\scripts\sync_canis_models_to_llama.ps1"
echo.

echo [1/4] Starting llama-server...
if "!USE_WT!"=="1" (
    wt -w 0 new-tab --title "llama-server" -d "%CLI_DIR%" cmd /k "call start_canis_server.bat"
) else (
    start "llama-server" /D "%CLI_DIR%" cmd /k "call start_canis_server.bat"
)

echo [2/4] Waiting 10 seconds for Gemma 4 model to load...
timeout /t 10   	 /nobreak

if not defined CANIS_API_PORT set "CANIS_API_PORT=5000"

set "START_API=1"
powershell -NoProfile -Command "exit ((Get-NetTCPConnection -LocalPort %CANIS_API_PORT% -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0)" >nul 2>&1
if !errorlevel! equ 0 set "START_API=0"

echo [3/4] Canis API Server (port %CANIS_API_PORT%)...
if "!START_API!"=="0" (
    echo       Port %CANIS_API_PORT% already in use - reusing existing API or stop it first.
    echo       To free the port:  taskkill /PID ^(see netstat -ano ^| findstr :%CANIS_API_PORT%^) /F
) else if "!USE_WT!"=="1" (
    wt -w 0 new-tab --title "Canis API" -d "%CLI_DIR%" cmd /k "%PY% -m canis.interfaces.server --host 0.0.0.0 --port %CANIS_API_PORT%"
) else (
    start "Canis API" /D "%CLI_DIR%" cmd /k "%PY% -m canis.interfaces.server --host 0.0.0.0 --port %CANIS_API_PORT%"
)

echo [4/4] Starting Canis DEV CLI...
timeout /t 2 /nobreak
if "!USE_WT!"=="1" (
    wt -w 0 new-tab --title "Canis DEV" -d "%CLI_DIR%" cmd /k "call canis_env.bat && %PY% -m canis.interfaces.cli --host 127.0.0.1 --port 8080"
) else (
    start "Canis DEV" /D "%CLI_DIR%" cmd /k "call canis_env.bat && %PY% -m canis.interfaces.cli --host 127.0.0.1 --port 8080"
)

echo.
echo  ================================================================
echo    ALL SERVICES LAUNCHED
echo  ================================================================
echo.
echo    llama-server:  http://127.0.0.1:8080
echo    Canis API:     http://localhost:%CANIS_API_PORT%  (optional - CLI uses :8080)
echo    Canis DEV:     interactive CLI
echo.
echo    In CLI:  /adapter list
echo             /adapter use gemma4good-51k
echo.
pause
