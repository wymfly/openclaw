@echo off
setlocal
set "OPENCLAW_RELEASE_ROOT=%~dp0publish"
if "%OPENCLAW_RELEASE_PORT%"=="" set "OPENCLAW_RELEASE_PORT=8088"
if "%OPENCLAW_RELEASE_HOST%"=="" set "OPENCLAW_RELEASE_HOST=0.0.0.0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" "%~dp0scripts\windows\serve-release-http.mjs"
  ) else (
    echo node not found on PATH
    exit /b 1
  )
) else (
  node "%~dp0scripts\windows\serve-release-http.mjs"
)
