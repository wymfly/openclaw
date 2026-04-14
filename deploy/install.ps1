param(
    [ValidateSet("bare-metal")]
    [string]$Mode = "bare-metal",
    [string]$UpgradePackage,
    [switch]$DryRun,
    [switch]$Rollback,
    [switch]$Status,
    [switch]$Help
)

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

if ($Help) {
    Show-InstallHelp -Layout $layout
    exit 0
}

if ($Status) {
    Show-DeployStatus -Layout $layout
    exit 0
}

if ($Rollback) {
    Invoke-DeployRollback -Layout $layout
    exit 0
}

if (-not [string]::IsNullOrWhiteSpace($UpgradePackage)) {
    Invoke-DeployUpgradeFromPackage -Layout $layout -PackagePath $UpgradePackage -DryRun:$DryRun
    exit 0
}

if ($DryRun) {
    Write-DeployInfo "Dry run: bare-metal install would run with the current package/repo contents."
    exit 0
}

if ($Mode -ne "bare-metal") {
    Write-DeployError "Only Windows bare-metal mode is supported by deploy install.ps1."
}

Install-DeployBareMetal -Layout $layout
