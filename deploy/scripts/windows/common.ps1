Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-DeployInfo {
    param([string]$Message)
    Write-Host "[deploy] $Message"
}

function Write-DeployWarn {
    param([string]$Message)
    Write-Host "[deploy] WARN: $Message" -ForegroundColor Yellow
}

function Write-DeployError {
    param([string]$Message)
    throw "[deploy] ERROR: $Message"
}

function Ensure-ExecutionPolicyForProcess {
    try {
        $policy = Get-ExecutionPolicy
    } catch {
        return
    }
    if ($policy -eq "Restricted" -or $policy -eq "AllSigned") {
        try {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -ErrorAction Stop
            Write-DeployInfo "Set execution policy to RemoteSigned for this process"
        } catch {
            Write-DeployWarn "Could not relax execution policy for this process. npm/pnpm PowerShell shims may fail."
        }
    }
}

function Resolve-FullPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "Path cannot be empty"
    }

    $item = Get-Item -LiteralPath $Path -ErrorAction Stop
    return $item.FullName
}

function Resolve-DeployLayout {
    param([Parameter(Mandatory = $true)][string]$DeployDir)

    $deployDirFull = Resolve-FullPath -Path $DeployDir
    $packagedManifest = Join-Path $deployDirFull "..\..\manifest.json"
    if (Test-Path -LiteralPath $packagedManifest) {
        $packageRoot = Resolve-FullPath -Path (Join-Path $deployDirFull "..\..")
        $sourceDir = Resolve-FullPath -Path (Join-Path $packageRoot "source")
        return [pscustomobject]@{
            DeployDir = $deployDirFull
            PackageRoot = $packageRoot
            SourceDir = $sourceDir
            IsPackagedInstall = $true
        }
    }

    $packageRoot = Resolve-FullPath -Path (Join-Path $deployDirFull "..")
    return [pscustomobject]@{
        DeployDir = $deployDirFull
        PackageRoot = $packageRoot
        SourceDir = $packageRoot
        IsPackagedInstall = $false
    }
}

function Get-DeployScriptPath {
    param(
        [Parameter(Mandatory = $true)]$Layout,
        [Parameter(Mandatory = $true)][string]$ScriptName
    )

    return Join-Path $Layout.DeployDir (Join-Path "scripts" $ScriptName)
}

function Read-EnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $result = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $result
    }

    # Windows PowerShell 5 defaults to ANSI when a file has no BOM. Our deploy
    # env templates contain UTF-8 Chinese comments, so read explicitly as UTF-8
    # to avoid mangling line boundaries and dropping keys such as CPA_API_KEY.
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }
        $idx = $trimmed.IndexOf("=")
        if ($idx -lt 1) {
            continue
        }
        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1)
        if ($value.Length -ge 2) {
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $result[$key] = $value
    }
    return $result
}

function Ensure-DeployEnvFile {
    param([Parameter(Mandatory = $true)]$Layout)

    $envPath = Join-Path $Layout.DeployDir ".env"
    if (Test-Path -LiteralPath $envPath) {
        return $envPath
    }

    $examplePath = Join-Path $Layout.DeployDir ".env.example"
    if (-not (Test-Path -LiteralPath $examplePath)) {
        Write-DeployError ".env.example not found at $examplePath"
    }

    Copy-Item -LiteralPath $examplePath -Destination $envPath -Force
    Write-DeployInfo "Created .env from .env.example"
    return $envPath
}

function Import-DeployEnvironment {
    param([Parameter(Mandatory = $true)]$Layout)

    $envPath = Ensure-DeployEnvFile -Layout $Layout
    $values = Read-EnvFile -Path $envPath
    foreach ($entry in $values.GetEnumerator()) {
        Set-Item -Path ("env:{0}" -f $entry.Key) -Value ([string]$entry.Value)
    }
    return $envPath
}

function Import-DeployEnvironmentIfPresent {
    param([Parameter(Mandatory = $true)]$Layout)

    $envPath = Join-Path $Layout.DeployDir ".env"
    if (-not (Test-Path -LiteralPath $envPath)) {
        return $null
    }
    $values = Read-EnvFile -Path $envPath
    foreach ($entry in $values.GetEnumerator()) {
        Set-Item -Path ("env:{0}" -f $entry.Key) -Value ([string]$entry.Value)
    }
    return $envPath
}

function Refresh-ProcessPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $segments = @()
    if (-not [string]::IsNullOrWhiteSpace($machinePath)) {
        $segments += $machinePath
    }
    if (-not [string]::IsNullOrWhiteSpace($userPath)) {
        $segments += $userPath
    }
    $env:Path = $segments -join ";"
}

function Resolve-CommandPath {
    param([Parameter(Mandatory = $true)][string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        if ($candidate -match '^[A-Za-z]:\\' -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }

        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command -and $command.Source) {
            return $command.Source
        }
    }
    return $null
}

function Get-TarCommandPath {
    $candidates = @(
        "tar.exe",
        "tar",
        "C:\Program Files\Git\usr\bin\tar.exe",
        "C:\Program Files\Git\mingw64\bin\tar.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command -and $command.Source) {
            return $command.Source
        }
    }
    return $null
}

function Push-TarSupportPath {
    param([Parameter(Mandatory = $true)][string]$TarPath)

    $tarDir = Split-Path -Parent $TarPath
    if ([string]::IsNullOrWhiteSpace($tarDir)) {
        return $null
    }

    $originalPath = $env:Path
    $extraDirs = @($tarDir)
    $siblingGzip = Join-Path $tarDir "gzip.exe"
    if (Test-Path -LiteralPath $siblingGzip) {
        $extraDirs += $tarDir
    }
    $gitUsrBin = "C:\Program Files\Git\usr\bin"
    if ((Test-Path -LiteralPath (Join-Path $gitUsrBin "gzip.exe")) -and -not ($extraDirs -contains $gitUsrBin)) {
        $extraDirs += $gitUsrBin
    }

    foreach ($dir in ($extraDirs | Select-Object -Unique)) {
        if (-not [string]::IsNullOrWhiteSpace($dir) -and -not (($env:Path -split ';') -contains $dir)) {
            $env:Path = "$dir;$env:Path"
        }
    }
    return $originalPath
}

function Pop-TarSupportPath {
    param([string]$OriginalPath)
    if ($null -ne $OriginalPath) {
        $env:Path = $OriginalPath
    }
}

function Push-GitBashSupportPath {
    $gitUsrBin = "C:\Program Files\Git\usr\bin"
    if (-not (Test-Path -LiteralPath $gitUsrBin)) {
        return $null
    }
    $originalPath = $env:Path
    if (-not (($env:Path -split ';') -contains $gitUsrBin)) {
        $env:Path = "$gitUsrBin;$env:Path"
    }
    return $originalPath
}

function Convert-PathForTar {
    param(
        [Parameter(Mandatory = $true)][string]$TarPath,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    if ($TarPath -match 'Git\\(usr|mingw64)\\bin\\tar\.exe$' -and $TargetPath -match '^[A-Za-z]:\\') {
        $drive = $TargetPath.Substring(0, 1).ToLowerInvariant()
        $rest = $TargetPath.Substring(2).Replace('\', '/')
        if (-not $rest.StartsWith('/')) {
            $rest = "/$rest"
        }
        return "/$drive$rest"
    }
    return $TargetPath
}

function Get-NodeCommandPath {
    $programFilesNode = if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) { Join-Path $env:ProgramFiles "nodejs\node.exe" } else { $null }
    return Resolve-CommandPath -Candidates @($programFilesNode, "C:\Program Files\nodejs\node.exe", "node.exe", "node")
}

function Get-NpmCommandPath {
    return Resolve-CommandPath -Candidates @("npm.cmd", "npm.exe", "npm")
}

function Get-PnpmCommandPath {
    return Resolve-CommandPath -Candidates @("pnpm.cmd", "pnpm.exe", "pnpm")
}

function Get-Pm2CommandPath {
    return Resolve-CommandPath -Candidates @("pm2.cmd", "pm2.exe", "pm2")
}

function Test-NodeVersion {
    $node = Get-NodeCommandPath
    if (-not $node) {
        return $false
    }
    try {
        $version = (& $node --version 2>$null)
        if (-not $version) {
            return $false
        }
        $major = [int](($version -replace '^v', '') -split '\.')[0]
        return $major -ge 22
    } catch {
        return $false
    }
}

function Install-NodeIfNeeded {
    if (Test-NodeVersion) {
        $node = Get-NodeCommandPath
        $version = (& $node --version 2>$null)
        Write-DeployInfo "Node.js $version found"
        return
    }

    Write-DeployInfo "Node.js 22+ not found. Attempting auto-install..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        & winget install OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements
        Refresh-ProcessPath
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        & choco install nodejs-lts -y
        Refresh-ProcessPath
    } elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
        & scoop install nodejs-lts
        Refresh-ProcessPath
    } else {
        Write-DeployError "Could not auto-install Node.js. Install Node.js 22+ manually."
    }

    if (-not (Test-NodeVersion)) {
        Write-DeployError "Node.js installation did not make Node.js 22+ available in this shell. Restart PowerShell and re-run the installer."
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter()][string[]]$Arguments = @(),
        [string]$FailureMessage = "Command failed"
    )

    $stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-deploy-{0}.out" -f ([System.Guid]::NewGuid().ToString('N')))
    $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-deploy-{0}.err" -f ([System.Guid]::NewGuid().ToString('N')))
    try {
        $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        if (Test-Path -LiteralPath $stdoutPath) {
            Get-Content -LiteralPath $stdoutPath | ForEach-Object { Write-Host $_ }
        }
        if (Test-Path -LiteralPath $stderrPath) {
            Get-Content -LiteralPath $stderrPath | ForEach-Object {
                if (-not [string]::IsNullOrWhiteSpace($_)) {
                    Write-Host $_
                }
            }
        }
        $exitCode = $process.ExitCode
    } finally {
        Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
    }

    if ($exitCode -ne 0) {
        Write-DeployError "$FailureMessage (exit code $exitCode)"
    }
}

function Ensure-PnpmIfNeeded {
    if (Get-PnpmCommandPath) {
        $pnpm = Get-PnpmCommandPath
        $version = (& $pnpm --version 2>$null)
        if ($version) {
            Write-DeployInfo "pnpm $version found"
        }
        return
    }

    $corepack = Resolve-CommandPath -Candidates @("corepack.cmd", "corepack.exe", "corepack")
    if ($corepack) {
        try {
            & $corepack enable | Out-Null
            & $corepack prepare pnpm@latest --activate | Out-Null
            if (Get-PnpmCommandPath) {
                $pnpm = Get-PnpmCommandPath
                Write-DeployInfo "pnpm $((& $pnpm --version 2>$null)) installed via corepack"
                return
            }
        } catch {
            Write-DeployWarn "corepack could not activate pnpm, falling back to npm install -g pnpm"
        }
    }

    $npm = Get-NpmCommandPath
    if (-not $npm) {
        Write-DeployError "npm not found on PATH after Node.js installation"
    }

    $previousScriptShell = $env:NPM_CONFIG_SCRIPT_SHELL
    $env:NPM_CONFIG_SCRIPT_SHELL = "cmd.exe"
    try {
        Invoke-Checked -FilePath $npm -Arguments @("install", "-g", "pnpm") -FailureMessage "Failed to install pnpm"
    } finally {
        if ($null -eq $previousScriptShell) {
            Remove-Item Env:NPM_CONFIG_SCRIPT_SHELL -ErrorAction SilentlyContinue
        } else {
            $env:NPM_CONFIG_SCRIPT_SHELL = $previousScriptShell
        }
    }
}

function Ensure-Pm2IfNeeded {
    if (Get-Pm2CommandPath) {
        return
    }

    $npm = Get-NpmCommandPath
    if (-not $npm) {
        Write-DeployError "npm not found on PATH after Node.js installation"
    }

    $previousScriptShell = $env:NPM_CONFIG_SCRIPT_SHELL
    $env:NPM_CONFIG_SCRIPT_SHELL = "cmd.exe"
    try {
        Invoke-Checked -FilePath $npm -Arguments @("install", "-g", "pm2") -FailureMessage "Failed to install PM2"
    } finally {
        if ($null -eq $previousScriptShell) {
            Remove-Item Env:NPM_CONFIG_SCRIPT_SHELL -ErrorAction SilentlyContinue
        } else {
            $env:NPM_CONFIG_SCRIPT_SHELL = $previousScriptShell
        }
    }
}

function Invoke-NodeDeployScript {
    param(
        [Parameter(Mandatory = $true)]$Layout,
        [Parameter(Mandatory = $true)][string]$ScriptName,
        [Parameter()][string[]]$Arguments = @(),
        [string]$FailureMessage = "Node deploy helper failed"
    )

    $node = Get-NodeCommandPath
    if (-not $node) {
        Write-DeployError "node not found on PATH"
    }
    $scriptPath = Get-DeployScriptPath -Layout $Layout -ScriptName $ScriptName
    Invoke-Checked -FilePath $node -Arguments (@($scriptPath) + $Arguments) -FailureMessage $FailureMessage
}

function Invoke-PnpmInSource {
    param(
        [Parameter(Mandatory = $true)]$Layout,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$FailureMessage = "pnpm command failed"
    )

    $pnpm = Get-PnpmCommandPath
    if (-not $pnpm) {
        Write-DeployError "pnpm not found on PATH"
    }

    Push-Location $Layout.SourceDir
    $previousGitSshCommand = $env:GIT_SSH_COMMAND
    $previousGitConfigGlobal = $env:GIT_CONFIG_GLOBAL
    if ([string]::IsNullOrWhiteSpace($env:GIT_SSH_COMMAND)) {
        $env:GIT_SSH_COMMAND = 'ssh -o StrictHostKeyChecking=accept-new'
    }
    $tempGitConfigPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-deploy-git-{0}.gitconfig" -f ([System.Guid]::NewGuid().ToString('N')))
    @"
[url "https://github.com/"]
    insteadOf = git@github.com:
    insteadOf = ssh://git@github.com/
    insteadOf = git+ssh://git@github.com/
"@ | Set-Content -LiteralPath $tempGitConfigPath -Encoding ASCII
    $env:GIT_CONFIG_GLOBAL = $tempGitConfigPath
    try {
        Invoke-Checked -FilePath $pnpm -Arguments $Arguments -FailureMessage $FailureMessage
    } finally {
        if ($null -eq $previousGitSshCommand) {
            Remove-Item Env:GIT_SSH_COMMAND -ErrorAction SilentlyContinue
        } else {
            $env:GIT_SSH_COMMAND = $previousGitSshCommand
        }
        if ($null -eq $previousGitConfigGlobal) {
            Remove-Item Env:GIT_CONFIG_GLOBAL -ErrorAction SilentlyContinue
        } else {
            $env:GIT_CONFIG_GLOBAL = $previousGitConfigGlobal
        }
        Remove-Item -LiteralPath $tempGitConfigPath -Force -ErrorAction SilentlyContinue
        Pop-Location
    }
}

function Install-PnpmDependenciesWithFallback {
    param(
        [Parameter(Mandatory = $true)]$Layout,
        [string]$FailureMessage = 'Failed to install dependencies'
    )

    try {
        Invoke-PnpmInSource -Layout $Layout -Arguments @('install', '--frozen-lockfile', '--ignore-scripts') -FailureMessage $FailureMessage
    } catch {
        Write-DeployWarn 'pnpm frozen-lockfile install failed; retrying with --no-frozen-lockfile for deploy resilience.'
        Invoke-PnpmInSource -Layout $Layout -Arguments @('install', '--no-frozen-lockfile', '--ignore-scripts') -FailureMessage $FailureMessage
    }
}

function Get-OpenClawStateDir {
    param([Parameter(Mandatory = $true)]$Layout)

    if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_STATE_DIR)) {
        if ([System.IO.Path]::IsPathRooted($env:OPENCLAW_STATE_DIR)) {
            return $env:OPENCLAW_STATE_DIR
        }
        return Join-Path $Layout.PackageRoot $env:OPENCLAW_STATE_DIR
    }
    return Join-Path $Layout.PackageRoot "data\.openclaw"
}

function Get-DeployDataDir {
    param([Parameter(Mandatory = $true)]$Layout)

    return Split-Path -Parent (Get-OpenClawStateDir -Layout $Layout)
}

function Get-DeckDataDir {
    param([Parameter(Mandatory = $true)]$Layout)

    if (-not [string]::IsNullOrWhiteSpace($env:DECK_DATA_DIR)) {
        if ([System.IO.Path]::IsPathRooted($env:DECK_DATA_DIR)) {
            return $env:DECK_DATA_DIR
        }
        return Join-Path $Layout.PackageRoot $env:DECK_DATA_DIR
    }
    return Join-Path $Layout.PackageRoot 'data\openclaw-deck'
}

function Test-HttpEndpoint {
    param([Parameter(Mandatory = $true)][string]$Url)

    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Stop-DeployPm2Processes {
    $pm2 = Get-Pm2CommandPath
    if (-not $pm2) {
        return
    }

    $cmd = Resolve-CommandPath -Candidates @('cmd.exe', 'cmd')
    if (-not $cmd) {
        return
    }

    foreach ($name in @("openclaw-gateway", "openclaw-deck")) {
        & $cmd /d /c "`"$pm2`" describe $name >nul 2>nul"
        if ($LASTEXITCODE -eq 0) {
            & $cmd /d /c "`"$pm2`" delete $name >nul 2>nul"
        }
    }
    & $cmd /d /c "`"$pm2`" save --force >nul 2>nul"
}

function Sync-DirectoryTree {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExcludeDirectories = @(),
        [string[]]$ExcludeFiles = @()
    )

    $robocopy = Resolve-CommandPath -Candidates @("robocopy.exe", "robocopy")
    if (-not $robocopy) {
        Write-DeployError "robocopy not found on PATH"
    }

    $arguments = @($Source, $Destination, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    foreach ($dir in $ExcludeDirectories) {
        $arguments += @("/XD", $dir)
    }
    foreach ($file in $ExcludeFiles) {
        $arguments += @("/XF", $file)
    }

    & $robocopy @arguments | Out-Host
    if ($LASTEXITCODE -ge 8) {
        Write-DeployError "robocopy failed with exit code $LASTEXITCODE"
    }
}

function Test-PrebuiltGateway {
    param([Parameter(Mandatory = $true)]$Layout)
    return Test-Path -LiteralPath (Join-Path $Layout.SourceDir "dist\cli-startup-metadata.json")
}

function Test-PrebuiltDeck {
    param([Parameter(Mandatory = $true)]$Layout)
    return Test-Path -LiteralPath (Join-Path $Layout.SourceDir "dashboard\.next\standalone\dashboard\server.js")
}

function Get-FileHashValue {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}
