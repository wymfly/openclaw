@echo off
setlocal

REM OpenClaw Installer — Windows entry point
REM Finds bash and forwards to the real install script.

set "SCRIPT_DIR=%~dp0"

REM Detect layout: package root (source\deploy\scripts\) or repo deploy\ (scripts\)
if exist "%SCRIPT_DIR%source\deploy\scripts\install.sh" (
  set "INSTALL_SH=%SCRIPT_DIR%source\deploy\scripts\install.sh"
) else if exist "%SCRIPT_DIR%scripts\install.sh" (
  set "INSTALL_SH=%SCRIPT_DIR%scripts\install.sh"
) else (
  echo [install.bat] ERROR: install.sh not found.
  echo Expected at: %SCRIPT_DIR%source\deploy\scripts\install.sh
  echo          or: %SCRIPT_DIR%scripts\install.sh
  pause
  exit /b 1
)

set "ARGS=%*"
if "%ARGS%"=="" set "ARGS=bare-metal"

REM Convert Windows backslash path to forward slash for bash
set "BASH_PATH=%INSTALL_SH:\=/%"
REM Convert drive letter D:/... to /d/... for Git Bash / MSYS2
set "DRIVE_LETTER=%BASH_PATH:~0,1%"
set "BASH_PATH=/%DRIVE_LETTER%%BASH_PATH:~2%"

REM Try Git for Windows bash
where bash >nul 2>&1 && (
  echo [install.bat] Using bash from PATH...
  bash "%BASH_PATH%" %ARGS%
  goto :done
)

REM Try common Git for Windows location
if exist "C:\Program Files\Git\bin\bash.exe" (
  echo [install.bat] Using Git for Windows bash...
  "C:\Program Files\Git\bin\bash.exe" "%BASH_PATH%" %ARGS%
  goto :done
)

REM Try WSL — needs /mnt/d/... format
set "WSL_PATH=/mnt/%DRIVE_LETTER%%BASH_PATH:~2%"
where wsl >nul 2>&1 && (
  echo [install.bat] Using WSL bash...
  wsl bash "%WSL_PATH%" %ARGS%
  goto :done
)

echo [install.bat] ERROR: bash not found.
echo.
echo Please install one of:
echo   - Git for Windows: https://git-scm.com/download/win
echo   - WSL: wsl --install
echo.
echo Then re-run: install.bat
pause
exit /b 1

:done
if %ERRORLEVEL% neq 0 (
  echo.
  echo [install.bat] Install finished with errors.
  pause
)
endlocal
