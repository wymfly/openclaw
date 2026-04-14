param(
    [string]$Package,
    [switch]$DryRun,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Help -or [string]::IsNullOrWhiteSpace($Package)) {
    Write-Host "Usage: powershell -ExecutionPolicy Bypass -File .\update.ps1 -Package <openclaw-deploy-*.tar.gz> [-DryRun]"
    if ($Help) {
        exit 0
    }
    exit 1
}

$installScript = Join-Path $PSScriptRoot "install.ps1"
if (-not (Test-Path -LiteralPath $installScript)) {
    $installScript = Join-Path $PSScriptRoot "source\deploy\install.ps1"
}
if (-not (Test-Path -LiteralPath $installScript)) {
    throw "Could not locate install.ps1 from $PSScriptRoot"
}

& $installScript -UpgradePackage $Package -DryRun:$DryRun
