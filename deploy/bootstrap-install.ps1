param(
    [string]$ManifestUrl = "__WINDOWS_MANIFEST_URL__",
    [string]$PackageUrl,
    [string]$InstallRoot = "$env:LOCALAPPDATA\OpenClawDeploy",
    [switch]$DryRun,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-BootstrapInfo {
    param([string]$Message)
    Write-Host "[bootstrap] $Message"
}

function Ensure-ExecutionPolicyForProcess {
    try {
        $policy = Get-ExecutionPolicy
        if ($policy -eq "Restricted" -or $policy -eq "AllSigned") {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -ErrorAction Stop
        }
    } catch {
        Write-BootstrapInfo "Could not adjust execution policy automatically; continuing."
    }
}

function Resolve-InstallRoot {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "InstallRoot cannot be empty"
    }
    return [System.IO.Path]::GetFullPath($Path)
}

function Get-PackageManifest {
    param(
        [string]$ManifestUrl,
        [string]$PackageUrlOverride
    )

    if (-not [string]::IsNullOrWhiteSpace($PackageUrlOverride)) {
        return [pscustomobject]@{
            packageUrl = $PackageUrlOverride
            packageSha256 = $null
            version = $null
        }
    }

    if ([string]::IsNullOrWhiteSpace($ManifestUrl) -or $ManifestUrl -like '*__WINDOWS_MANIFEST_URL__*') {
        throw "ManifestUrl is not configured. Supply -ManifestUrl or generate bootstrap assets with --bootstrap-base-url."
    }

    return Invoke-RestMethod -Uri $ManifestUrl -Method Get
}

function Download-File {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    Write-BootstrapInfo ("Downloading {0}" -f $Url)
    Invoke-WebRequest -Uri $Url -OutFile $Destination
}

function Verify-FileSha256 {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$ExpectedSha256
    )

    if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) {
        Write-BootstrapInfo "No SHA-256 provided; skipping checksum verification."
        return
    }

    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    $expected = $ExpectedSha256.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "SHA-256 mismatch. Expected $expected but got $actual"
    }
    Write-BootstrapInfo "SHA-256 verified"
}

function Expand-TarGzPackage {
    param(
        [Parameter(Mandatory = $true)][string]$PackagePath,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $tarCandidates = @(
        "tar.exe",
        "tar",
        "C:\Program Files\Git\usr\bin\tar.exe",
        "C:\Program Files\Git\mingw64\bin\tar.exe"
    )
    $tarPath = $null
    foreach ($candidate in $tarCandidates) {
        if (Test-Path -LiteralPath $candidate) {
            $tarPath = $candidate
            break
        }
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source) {
            $tarPath = $cmd.Source
            break
        }
    }
    if (-not $tarPath) {
        throw "tar not found on PATH"
    }

    $originalPath = $env:Path
    $tarDir = Split-Path -Parent $tarPath
    $gitUsrBin = "C:\Program Files\Git\usr\bin"
    foreach ($dir in @($tarDir, $gitUsrBin)) {
        if (-not [string]::IsNullOrWhiteSpace($dir) -and (Test-Path -LiteralPath $dir) -and -not (($env:Path -split ';') -contains $dir)) {
            $env:Path = "$dir;$env:Path"
        }
    }

    $packagePathForTar = $PackagePath
    $destinationForTar = $Destination
    if ($tarPath -match 'Git\\(usr|mingw64)\\bin\\tar\.exe$') {
        if ($PackagePath -match '^[A-Za-z]:\\') {
            $drive = $PackagePath.Substring(0, 1).ToLowerInvariant()
            $rest = $PackagePath.Substring(2).Replace('\', '/')
            if (-not $rest.StartsWith('/')) { $rest = "/$rest" }
            $packagePathForTar = "/$drive$rest"
        }
        if ($Destination -match '^[A-Za-z]:\\') {
            $drive = $Destination.Substring(0, 1).ToLowerInvariant()
            $rest = $Destination.Substring(2).Replace('\', '/')
            if (-not $rest.StartsWith('/')) { $rest = "/$rest" }
            $destinationForTar = "/$drive$rest"
        }
    }

    try {
        & $tarPath -xzf $packagePathForTar -C $destinationForTar
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to extract package"
        }
    } finally {
        $env:Path = $originalPath
    }

    $pkgDir = Get-ChildItem -LiteralPath $Destination -Directory | Select-Object -First 1
    if (-not $pkgDir) {
        throw "Extracted package directory not found"
    }
    return $pkgDir.FullName
}

function Copy-ExtractedPackageToInstallRoot {
    param(
        [Parameter(Mandatory = $true)][string]$ExtractedPackageRoot,
        [Parameter(Mandatory = $true)][string]$InstallRoot
    )

    if (Test-Path -LiteralPath $InstallRoot) {
        $existing = Get-ChildItem -LiteralPath $InstallRoot -Force -ErrorAction SilentlyContinue
        if ($existing) {
            throw "Install root already exists and is not recognized as an existing OpenClaw deploy install: $InstallRoot"
        }
    } else {
        New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
    }

    Get-ChildItem -LiteralPath $ExtractedPackageRoot -Force | Copy-Item -Destination $InstallRoot -Recurse -Force
}

function Invoke-PackagedInstall {
    param([Parameter(Mandatory = $true)][string]$InstallRoot)

    $installScript = Join-Path $InstallRoot 'install.ps1'
    if (-not (Test-Path -LiteralPath $installScript)) {
        throw "Packaged install.ps1 not found at $installScript"
    }

    & $installScript
    if ($LASTEXITCODE -ne 0) {
        throw "Packaged install.ps1 failed with exit code $LASTEXITCODE"
    }
}

function Invoke-InstalledUpdate {
    param(
        [Parameter(Mandatory = $true)][string]$InstallRoot,
        [Parameter(Mandatory = $true)][string]$PackagePath,
        [switch]$DryRun
    )

    $updateScript = Join-Path $InstallRoot 'update.ps1'
    if (-not (Test-Path -LiteralPath $updateScript)) {
        throw "Installed update.ps1 not found at $updateScript"
    }

    & $updateScript -Package $PackagePath -DryRun:$DryRun
    if ($LASTEXITCODE -ne 0) {
        throw "Installed update.ps1 failed with exit code $LASTEXITCODE"
    }
}

if ($Help) {
    Write-Host "Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1 [-ManifestUrl <url>] [-PackageUrl <url>] [-InstallRoot <path>] [-DryRun]"
    exit 0
}

Ensure-ExecutionPolicyForProcess
$resolvedInstallRoot = Resolve-InstallRoot -Path $InstallRoot
$manifest = Get-PackageManifest -ManifestUrl $ManifestUrl -PackageUrlOverride $PackageUrl
if ([string]::IsNullOrWhiteSpace($manifest.packageUrl)) {
    throw "Manifest did not provide packageUrl"
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$packagePath = Join-Path $tempDir 'openclaw-deploy.tar.gz'

try {
    Download-File -Url $manifest.packageUrl -Destination $packagePath
    Verify-FileSha256 -Path $packagePath -ExpectedSha256 $manifest.packageSha256

    $existingInstallScript = Join-Path $resolvedInstallRoot 'install.ps1'
    if (Test-Path -LiteralPath $existingInstallScript) {
        Write-BootstrapInfo ("Existing install detected at {0}" -f $resolvedInstallRoot)
        if ($DryRun) {
            Write-BootstrapInfo ("Would update existing install using package {0}" -f $manifest.packageUrl)
            exit 0
        }
        Invoke-InstalledUpdate -InstallRoot $resolvedInstallRoot -PackagePath $packagePath -DryRun:$false
        Write-BootstrapInfo "Update complete"
        exit 0
    }

    Write-BootstrapInfo ("No existing install detected; target root: {0}" -f $resolvedInstallRoot)
    if ($DryRun) {
        Write-BootstrapInfo ("Would extract package {0} into {1} and run packaged install.ps1" -f $manifest.packageUrl, $resolvedInstallRoot)
        exit 0
    }

    $extractDir = Join-Path $tempDir 'extract'
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
    $pkgRoot = Expand-TarGzPackage -PackagePath $packagePath -Destination $extractDir
    Copy-ExtractedPackageToInstallRoot -ExtractedPackageRoot $pkgRoot -InstallRoot $resolvedInstallRoot
    Invoke-PackagedInstall -InstallRoot $resolvedInstallRoot
    Write-BootstrapInfo "Install complete"
} finally {
    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
