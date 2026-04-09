@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "SH_SCRIPT=%SCRIPT_DIR%tui.sh"
set "BASH_EXE="

where bash >nul 2>&1
if !ERRORLEVEL! equ 0 (
  set "BASH_EXE=bash"
  goto :run
)

if exist "C:\Program Files\Git\bin\bash.exe" (
  set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
  goto :run
)

if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
  set "BASH_EXE=C:\Program Files (x86)\Git\bin\bash.exe"
  goto :run
)

for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\GitForWindows" /v InstallPath 2^>nul') do (
  if exist "%%b\bin\bash.exe" (
    set "BASH_EXE=%%b\bin\bash.exe"
    goto :run
  )
)

where wsl >nul 2>&1
if !ERRORLEVEL! equ 0 (
  set "BASH_EXE=wsl bash"
  goto :run
)

echo [tui.bat] ERROR: bash not found.
echo Please install Git for Windows: https://git-scm.com/download/win
pause
exit /b 1

:run
"%BASH_EXE%" "%SH_SCRIPT%" %*
if %ERRORLEVEL% neq 0 pause
endlocal
