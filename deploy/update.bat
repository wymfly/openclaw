@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%update.ps1"
set "PS_EXE="

where pwsh >nul 2>&1
if !ERRORLEVEL! equ 0 (
  set "PS_EXE=pwsh"
  goto :run
)

if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
  set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
  goto :run
)

where powershell >nul 2>&1
if !ERRORLEVEL! equ 0 (
  set "PS_EXE=powershell"
  goto :run
)

echo [update.bat] ERROR: PowerShell not found.
pause
exit /b 1

:run
"%PS_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
if %ERRORLEVEL% neq 0 pause
endlocal
