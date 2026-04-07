@echo off
setlocal enabledelayedexpansion

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

REM --- Find bash ---
set "BASH_EXE="

REM 1. PATH
where bash >nul 2>&1
if !ERRORLEVEL! equ 0 (
  set "BASH_EXE=bash"
  echo [install.bat] Using bash from PATH...
  goto :run
)

REM 2. Default install paths
if exist "C:\Program Files\Git\bin\bash.exe" (
  set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
  echo [install.bat] Using Git for Windows bash...
  goto :run
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
  set "BASH_EXE=C:\Program Files (x86)\Git\bin\bash.exe"
  goto :run
)

REM 3. Registry
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\GitForWindows" /v InstallPath 2^>nul') do (
  if exist "%%b\bin\bash.exe" (
    set "BASH_EXE=%%b\bin\bash.exe"
    echo [install.bat] Using Git from registry: %%b
    goto :run
  )
)

REM 4. WSL
where wsl >nul 2>&1
if !ERRORLEVEL! equ 0 (
  set "BASH_EXE=wsl bash"
  echo [install.bat] Using WSL bash...
  goto :run
)

echo [install.bat] ERROR: bash not found.
echo.
echo Please install Git for Windows: https://git-scm.com/download/win
echo Then re-run: install.bat
pause
exit /b 1

:run
echo [install.bat] Running: "%BASH_EXE%" "%INSTALL_SH%" %ARGS%
"%BASH_EXE%" "%INSTALL_SH%" %ARGS%

echo.
if %ERRORLEVEL% neq 0 (
  echo [install.bat] Install finished with errors. Exit code: %ERRORLEVEL%
) else (
  echo [install.bat] Install finished.
)
pause
endlocal
