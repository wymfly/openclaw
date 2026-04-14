Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$deployRoot = $PSScriptRoot
$helperPath = Join-Path $deployRoot "scripts\windows\install-or-upgrade.ps1"
if (-not (Test-Path -LiteralPath $helperPath)) {
    $deployRoot = Join-Path $PSScriptRoot "source\deploy"
    $helperPath = Join-Path $deployRoot "scripts\windows\install-or-upgrade.ps1"
}
if (-not (Test-Path -LiteralPath $helperPath)) {
    throw "Could not locate install-or-upgrade.ps1 from $PSScriptRoot"
}

. $helperPath

$layout = Resolve-DeployLayout -DeployDir $deployRoot
Show-DeployStatus -Layout $layout
