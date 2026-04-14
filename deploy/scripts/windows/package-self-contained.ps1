param(
    [string]$BasePackage,
    [string]$NodeModulesPath,
    [string]$OutputDir,
    [string]$PackageName,
    [string]$BootstrapBaseUrl,
    [switch]$Force,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")

function Write-Utf8NoBomFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-BasePackageStem {
    param([Parameter(Mandatory = $true)][string]$Path)

    $leaf = Split-Path -Leaf $Path
    if ($leaf.EndsWith(".tar.gz", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $leaf.Substring(0, $leaf.Length - 7)
    }
    return [System.IO.Path]::GetFileNameWithoutExtension($leaf)
}

function Update-SelfContainedManifest {
    param([Parameter(Mandatory = $true)][string]$ManifestPath)

    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        return $null
    }

    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    if (-not ($manifest.PSObject.Properties.Name -contains "contents")) {
        $manifest | Add-Member -NotePropertyName contents -NotePropertyValue ([pscustomobject]@{})
    }
    $manifest.contents | Add-Member -NotePropertyName nodeModules -NotePropertyValue $true -Force
    Write-Utf8NoBomFile -Path $ManifestPath -Content ($manifest | ConvertTo-Json -Depth 10)
    return $manifest
}

function Write-WindowsBootstrapAssets {
    param(
        [Parameter(Mandatory = $true)][string]$DeployRoot,
        [Parameter(Mandatory = $true)][string]$TarPath,
        [Parameter(Mandatory = $true)][string]$ManifestPath,
        [Parameter(Mandatory = $true)][string]$BootstrapBaseUrl,
        [Parameter(Mandatory = $true)][string]$OutputDirectory
    )

    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $normalizedBase = $BootstrapBaseUrl.TrimEnd('/')
    $packageFile = Split-Path -Leaf $TarPath
    $packageSha = Get-FileHashValue -Path $TarPath
    $latestManifest = [ordered]@{
        channel = "stable"
        version = [string]$manifest.version
        generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        packageFile = $packageFile
        packageUrl = "$normalizedBase/$packageFile"
        packageSha256 = $packageSha
    } | ConvertTo-Json -Depth 5
    $latestManifestPath = Join-Path $OutputDirectory "windows-latest.json"
    Write-Utf8NoBomFile -Path $latestManifestPath -Content $latestManifest

    $bootstrapTemplate = Join-Path $DeployRoot "bootstrap-install.ps1"
    if (-not (Test-Path -LiteralPath $bootstrapTemplate)) {
        Write-DeployError "bootstrap-install.ps1 not found at $bootstrapTemplate"
    }

    $bootstrapContent = Get-Content -LiteralPath $bootstrapTemplate -Raw
    $bootstrapOut = Join-Path $OutputDirectory "install.ps1"
    Write-Utf8NoBomFile -Path $bootstrapOut -Content ($bootstrapContent.Replace("__WINDOWS_MANIFEST_URL__", "$normalizedBase/windows-latest.json"))

    Write-DeployInfo ("Windows bootstrap manifest written: {0}" -f $latestManifestPath)
    Write-DeployInfo ("Windows bootstrap installer written: {0}" -f $bootstrapOut)
}

if ($Help -or [string]::IsNullOrWhiteSpace($BasePackage)) {
    Write-Host "Usage:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\\package-self-contained.ps1 -BasePackage <openclaw-deploy-*.tar.gz> [-NodeModulesPath <path>] [-OutputDir <dir>] [-PackageName <name>] [-BootstrapBaseUrl <url>] [-Force]"
    Write-Host ""
    Write-Host "This augments an existing deploy tarball with source\\node_modules from the current Windows machine,"
    Write-Host "producing a self-contained Windows package that can install/update without fetching npm/git dependencies."
    exit 0
}

$deployRoot = Resolve-FullPath -Path (Join-Path $PSScriptRoot "..\..")
$defaultNodeModules = Join-Path (Resolve-FullPath -Path (Join-Path $PSScriptRoot "..\..\..")) "node_modules"
$resolvedBasePackage = Resolve-FullPath -Path $BasePackage
$resolvedNodeModules = Resolve-FullPath -Path ($(if ([string]::IsNullOrWhiteSpace($NodeModulesPath)) { $defaultNodeModules } else { $NodeModulesPath }))
$resolvedOutputDir = if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    Resolve-FullPath -Path (Split-Path -Parent $resolvedBasePackage)
} else {
    $OutputDir
}

if (-not (Test-Path -LiteralPath $resolvedOutputDir)) {
    New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null
    $resolvedOutputDir = Resolve-FullPath -Path $resolvedOutputDir
}

$packageStem = if ([string]::IsNullOrWhiteSpace($PackageName)) {
    "{0}-windows-selfcontained" -f (Get-BasePackageStem -Path $resolvedBasePackage)
} else {
    $PackageName
}

$outputTar = Join-Path $resolvedOutputDir ("{0}.tar.gz" -f $packageStem)
if ((Test-Path -LiteralPath $outputTar) -and -not $Force) {
    Write-DeployError "Output already exists: $outputTar (use -Force to overwrite)"
}

$tar = Get-TarCommandPath
if (-not $tar) {
    Write-DeployError "tar not found on PATH"
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-selfcontained-{0}" -f ([System.Guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$originalTarPath = Push-TarSupportPath -TarPath $tar

try {
    $basePackageForTar = Convert-PathForTar -TarPath $tar -TargetPath $resolvedBasePackage
    $tempDirForTar = Convert-PathForTar -TarPath $tar -TargetPath $tempDir

    Write-DeployInfo ("Extracting base package: {0}" -f (Split-Path -Leaf $resolvedBasePackage))
    Invoke-Checked -FilePath $tar -Arguments @("-xzf", $basePackageForTar, "-C", $tempDirForTar) -FailureMessage "Failed to extract base package"

    $pkgDir = Get-ChildItem -LiteralPath $tempDir -Directory | Select-Object -First 1
    if (-not $pkgDir) {
        Write-DeployError "No package directory found after extracting $resolvedBasePackage"
    }

    $packageSourceDir = Join-Path $pkgDir.FullName "source"
    if (-not (Test-Path -LiteralPath $packageSourceDir)) {
        Write-DeployError "source/ missing in extracted package"
    }

    $destNodeModules = Join-Path $packageSourceDir "node_modules"
    if (Test-Path -LiteralPath $destNodeModules) {
        Remove-Item -LiteralPath $destNodeModules -Recurse -Force
    }

    Write-DeployInfo ("Copying node_modules from: {0}" -f $resolvedNodeModules)
    Sync-DirectoryTree -Source $resolvedNodeModules -Destination $destNodeModules

    # Copy per-extension node_modules (pnpm workspace creates these)
    $sourceRoot = Split-Path -Parent $resolvedNodeModules
    $extDir = Join-Path $sourceRoot "extensions"
    if (Test-Path -LiteralPath $extDir) {
        Get-ChildItem -LiteralPath $extDir -Directory | ForEach-Object {
            $extNm = Join-Path $_.FullName "node_modules"
            if (Test-Path -LiteralPath $extNm) {
                $destExtNm = Join-Path $packageSourceDir "extensions" $_.Name "node_modules"
                Write-DeployInfo ("Copying extensions/{0}/node_modules" -f $_.Name)
                Sync-DirectoryTree -Source $extNm -Destination $destExtNm
            }
        }
    }

    $manifestPath = Join-Path $pkgDir.FullName "manifest.json"
    Update-SelfContainedManifest -ManifestPath $manifestPath | Out-Null

    if (Test-Path -LiteralPath $outputTar) {
        Remove-Item -LiteralPath $outputTar -Force
    }

    $pkgParent = Split-Path -Parent $pkgDir.FullName
    $pkgParentForTar = Convert-PathForTar -TarPath $tar -TargetPath $pkgParent
    $outputTarForTar = Convert-PathForTar -TarPath $tar -TargetPath $outputTar
    Write-DeployInfo ("Creating self-contained package: {0}" -f $outputTar)
    Invoke-Checked -FilePath $tar -Arguments @("-czf", $outputTarForTar, "-C", $pkgParentForTar, $pkgDir.Name) -FailureMessage "Failed to create self-contained package"

    if (-not [string]::IsNullOrWhiteSpace($BootstrapBaseUrl)) {
        Write-WindowsBootstrapAssets -DeployRoot $deployRoot -TarPath $outputTar -ManifestPath $manifestPath -BootstrapBaseUrl $BootstrapBaseUrl -OutputDirectory $resolvedOutputDir
    }

    $size = (Get-Item -LiteralPath $outputTar).Length
    Write-DeployInfo ("Self-contained Windows package ready: {0}" -f $outputTar)
    Write-DeployInfo ("Size: {0:N0} bytes" -f $size)
} finally {
    Pop-TarSupportPath -OriginalPath $originalTarPath
    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
