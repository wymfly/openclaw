Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")
. (Join-Path $PSScriptRoot "service.ps1")

function Copy-DeckStandaloneAssets {
    param([Parameter(Mandatory = $true)]$Layout)

    $dashboardDir = Join-Path $Layout.SourceDir "dashboard"
    $standaloneDir = Join-Path $dashboardDir ".next\standalone\dashboard"
    $staticDir = Join-Path $dashboardDir ".next\static"
    $standaloneStatic = Join-Path $standaloneDir ".next\static"
    $publicDir = Join-Path $dashboardDir "public"
    $standalonePublic = Join-Path $standaloneDir "public"
    $entrySrc = Join-Path $dashboardDir "standalone-entry.mjs"
    $entryDst = Join-Path $standaloneDir "standalone-entry.mjs"

    if (Test-Path -LiteralPath $staticDir) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $standaloneStatic) | Out-Null
        if (Test-Path -LiteralPath $standaloneStatic) {
            Remove-Item -LiteralPath $standaloneStatic -Recurse -Force
        }
        Copy-Item -LiteralPath $staticDir -Destination $standaloneStatic -Recurse -Force
    }
    if (Test-Path -LiteralPath $publicDir) {
        if (Test-Path -LiteralPath $standalonePublic) {
            Remove-Item -LiteralPath $standalonePublic -Recurse -Force
        }
        Copy-Item -LiteralPath $publicDir -Destination $standalonePublic -Recurse -Force
    }
    if ((Test-Path -LiteralPath $entrySrc) -and -not (Test-Path -LiteralPath $entryDst)) {
        Copy-Item -LiteralPath $entrySrc -Destination $entryDst -Force
        Write-DeployInfo "Copied standalone-entry.mjs"
    }
}

function Restore-PreservedEntry {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExcludeChildren = @()
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return
    }

    $item = Get-Item -LiteralPath $Source
    if ($item.PSIsContainer) {
        New-Item -ItemType Directory -Force -Path $Destination | Out-Null
        Get-ChildItem -LiteralPath $Source -Force |
            Where-Object { $ExcludeChildren -notcontains $_.Name } |
            Copy-Item -Destination $Destination -Recurse -Force
        return
    }

    $parent = Split-Path -Parent $Destination
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Get-InstalledStatePath {
    param([Parameter(Mandatory = $true)]$Layout)
    return Join-Path (Get-DeployDataDir -Layout $Layout) ".installed.json"
}

function Write-InstalledState {
    param([Parameter(Mandatory = $true)]$Layout)

    $dataDir = Get-DeployDataDir -Layout $Layout
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    Invoke-NodeDeployScript -Layout $Layout -ScriptName "write-installed.js" -Arguments @($dataDir, $Layout.SourceDir) -FailureMessage "Failed to write .installed.json"
}

function Start-DeployServices {
    param([Parameter(Mandatory = $true)]$Layout)

    Start-DeployService -Layout $Layout
}

function Stop-DeployServices {
    Stop-DeployService -Layout $Layout
}

function Show-DeployStatus {
    param([Parameter(Mandatory = $true)]$Layout)

    Import-DeployEnvironmentIfPresent -Layout $Layout | Out-Null
    $gatewayPort = if ([string]::IsNullOrWhiteSpace($env:GATEWAY_PORT)) { "18789" } else { $env:GATEWAY_PORT }
    $deckPort = if ([string]::IsNullOrWhiteSpace($env:DECK_PORT)) { "3000" } else { $env:DECK_PORT }
    $stateDir = Get-OpenClawStateDir -Layout $Layout
    $deckDataDir = Get-DeckDataDir -Layout $Layout

    Write-Host "+----------------------------------------------+"
    Write-Host "|        OpenClaw Service Status               |"
    Write-Host "+----------------------------------------------+"
    Write-Host ""

    Write-Host "=== Service Registration ==="
    $registration = Get-DeployServiceRegistrationInfo -Layout $Layout
    if ($registration.Mode -eq "task") {
        Write-Host ("  Mode:        Scheduled Task")
        Write-Host ("  Task:        {0}" -f $registration.TaskName)
        if ($registration.TaskStatus) {
            Write-Host ("  Status:      {0}" -f $registration.TaskStatus)
        }
        if ($registration.LastRunTime) {
            Write-Host ("  Last run:    {0}" -f $registration.LastRunTime)
        }
        if ($registration.LastRunResult) {
            Write-Host ("  Last result: {0}" -f $registration.LastRunResult)
        }
    } elseif ($registration.Mode -eq "startup") {
        Write-Host ("  Mode:        Startup login item")
        Write-Host ("  Task:        {0}" -f $registration.TaskName)
        Write-Host ("  Path:        {0}" -f $registration.StartupEntryPath)
    } else {
        Write-Host "  Mode:        not installed"
    }

    $runtimeState = Read-DeploySupervisorState -Layout $Layout
    if ($null -ne $runtimeState) {
        Write-Host ("  Supervisor:  {0}" -f $runtimeState.supervisorPid)
        if ($runtimeState.gatewayPid) {
            Write-Host ("  Gateway PID: {0}" -f $runtimeState.gatewayPid)
        }
        if ($runtimeState.deckPid) {
            Write-Host ("  Deck PID:    {0}" -f $runtimeState.deckPid)
        }
    }
    Write-Host ""

    Write-Host "=== Health Probes ==="
    if (Test-HttpEndpoint -Url ("http://localhost:{0}/healthz" -f $gatewayPort)) {
        Write-Host ("  Gateway  (:{0})  OK healthy" -f $gatewayPort)
    } else {
        Write-Host ("  Gateway  (:{0})  ERROR unreachable" -f $gatewayPort)
    }

    if (Test-HttpEndpoint -Url ("http://localhost:{0}" -f $deckPort)) {
        Write-Host ("  Deck     (:{0})  OK healthy" -f $deckPort)
    } else {
        Write-Host ("  Deck     (:{0})  ERROR unreachable" -f $deckPort)
    }

    Write-Host ""
    Write-Host "=== Data Directories ==="
    if (Test-Path -LiteralPath $stateDir) {
        Write-Host ("  Gateway state: {0}" -f $stateDir)
        if (Test-Path -LiteralPath (Join-Path $stateDir "openclaw.json")) {
            Write-Host "    config: OK"
        } else {
            Write-Host "    config: MISSING"
        }
    } else {
        Write-Host ("  Gateway state: NOT FOUND ({0})" -f $stateDir)
    }

    if (Test-Path -LiteralPath $deckDataDir) {
        Write-Host ("  Deck data:     {0}" -f $deckDataDir)
        $jsonFiles = Get-ChildItem -LiteralPath $deckDataDir -Filter *.json -ErrorAction SilentlyContinue
        if ($jsonFiles) {
            Write-Host "    data files: OK"
        } else {
            Write-Host "    data files: EMPTY (will be created on first run)"
        }
    } else {
        Write-Host ("  Deck data:     NOT FOUND ({0})" -f $deckDataDir)
    }

    Write-Host ""
    Write-Host "=== Endpoints ==="
    Write-Host ("  Gateway: http://localhost:{0}" -f $gatewayPort)
    Write-Host ("  Deck:    http://localhost:{0}" -f $deckPort)
}

function Install-DeployBareMetal {
    param([Parameter(Mandatory = $true)]$Layout)

    Ensure-ExecutionPolicyForProcess
    Install-NodeIfNeeded
    Ensure-PnpmIfNeeded
    Import-DeployEnvironment -Layout $Layout | Out-Null
    $originalGitPath = Push-GitBashSupportPath

    Push-Location $Layout.SourceDir
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $Layout.SourceDir "node_modules"))) {
            Write-DeployInfo "Installing dependencies..."
            Install-PnpmDependenciesWithFallback -Layout $Layout -FailureMessage 'Failed to install dependencies'
        }

        if (-not (Test-PrebuiltGateway -Layout $Layout)) {
            Write-DeployInfo "Building Gateway..."
            Invoke-PnpmInSource -Layout $Layout -Arguments @("build") -FailureMessage "Failed to build Gateway"
        } else {
            Write-DeployInfo "Pre-built Gateway detected, skipping build."
        }

        if (-not (Test-PrebuiltDeck -Layout $Layout)) {
            Write-DeployInfo "Building Deck..."
            $dashboardDir = Join-Path $Layout.SourceDir "dashboard"
            Push-Location $dashboardDir
            try {
                $pnpm = Get-PnpmCommandPath
                Invoke-Checked -FilePath $pnpm -Arguments @("install") -FailureMessage "Failed to install dashboard dependencies"
                $npx = Resolve-CommandPath -Candidates @("npx.cmd", "npx.exe", "npx")
                if (-not $npx) {
                    Write-DeployError "npx not found on PATH"
                }
                Invoke-Checked -FilePath $npx -Arguments @("next", "build", "--webpack") -FailureMessage "Failed to build Deck"
            } finally {
                Pop-Location
            }
            Copy-DeckStandaloneAssets -Layout $Layout
        } else {
            Write-DeployInfo "Pre-built Deck detected, skipping build."
            Copy-DeckStandaloneAssets -Layout $Layout
        }
    } finally {
        Pop-Location
        Pop-TarSupportPath -OriginalPath $originalGitPath
    }

    $stateDir = Get-OpenClawStateDir -Layout $Layout
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    Invoke-NodeDeployScript -Layout $Layout -ScriptName "seed.js" -Arguments @($stateDir) -FailureMessage "Failed to seed deploy state"

    Stop-DeployPm2Processes
    Stop-DeployServices
    Install-DeployService -Layout $Layout | Out-Null
    Write-InstalledState -Layout $Layout

    $gatewayPort = if ([string]::IsNullOrWhiteSpace($env:GATEWAY_PORT)) { "18789" } else { $env:GATEWAY_PORT }
    $deckPort = if ([string]::IsNullOrWhiteSpace($env:DECK_PORT)) { "3000" } else { $env:DECK_PORT }
    Write-DeployInfo "=== Installation complete ==="
    Write-DeployInfo ("Gateway: http://localhost:{0}" -f $gatewayPort)
    Write-DeployInfo ("Deck:    http://localhost:{0}" -f $deckPort)
    Write-DeployInfo "Manage with:"
    $statusScriptPath = Join-Path $Layout.DeployDir 'status.ps1'
    Write-DeployInfo ('  powershell -ExecutionPolicy Bypass -File {0}' -f $statusScriptPath)
}

function Convert-CheckOutputToResult {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][AllowEmptyString()][string[]]$OutputLines)

    $joined = $OutputLines -join "`n"
    $match = [regex]::Match($joined, "__CHECK_RESULT__(.*?)__END__", [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $match.Success) {
        return $null
    }
    return ($match.Groups[1].Value | ConvertFrom-Json)
}

function Get-NewEnvVarNames {
    param(
        [Parameter(Mandatory = $true)][string]$CurrentEnvPath,
        [Parameter(Mandatory = $true)][string]$ExampleEnvPath
    )

    $currentNames = @{}
    foreach ($entry in (Read-EnvFile -Path $CurrentEnvPath).Keys) {
        $currentNames[$entry] = $true
    }

    $newNames = @()
    foreach ($entry in (Read-EnvFile -Path $ExampleEnvPath).Keys) {
        if (-not $currentNames.ContainsKey($entry)) {
            $newNames += $entry
        }
    }
    return $newNames
}

function Invoke-DeployUpgradeFromPackage {
    param(
        [Parameter(Mandatory = $true)]$Layout,
        [Parameter(Mandatory = $true)][string]$PackagePath,
        [switch]$DryRun
    )

    if (-not $Layout.IsPackagedInstall) {
        Write-DeployError "PowerShell package upgrades are only supported from extracted deploy packages, not live repo checkouts."
    }

    Ensure-ExecutionPolicyForProcess
    Install-NodeIfNeeded
    Ensure-PnpmIfNeeded
    Import-DeployEnvironment -Layout $Layout | Out-Null
    $originalGitPath = Push-GitBashSupportPath

    $resolvedPackage = Resolve-FullPath -Path $PackagePath
    $installRoot = $Layout.PackageRoot
    $installParent = Split-Path -Parent $installRoot
    $tempDir = Join-Path $installParent (".update-stage-{0}" -f ([System.Guid]::NewGuid().ToString("N")))
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

    try {
        $tar = Get-TarCommandPath
        if (-not $tar) {
            Write-DeployError "tar not found on PATH"
        }
        $originalTarPath = Push-TarSupportPath -TarPath $tar
        $resolvedPackageForTar = Convert-PathForTar -TarPath $tar -TargetPath $resolvedPackage
        $tempDirForTar = Convert-PathForTar -TarPath $tar -TargetPath $tempDir
        Write-DeployInfo 'Extracting package...'
        Invoke-Checked -FilePath $tar -Arguments @('-xzf', $resolvedPackageForTar, '-C', $tempDirForTar) -FailureMessage 'Failed to extract package'

        $newPkgDir = Get-ChildItem -LiteralPath $tempDir -Directory | Select-Object -First 1
        if (-not $newPkgDir) {
            Write-DeployError 'No directory found in package'
        }

        $newSource = Join-Path $newPkgDir.FullName 'source'
        if (-not (Test-Path -LiteralPath $newSource)) {
            $newSource = $newPkgDir.FullName
        }
        if (-not (Test-Path -LiteralPath (Join-Path $newSource 'package.json'))) {
            Write-DeployError 'Invalid package: package.json not found'
        }
        $packageHasNodeModules = Test-Path -LiteralPath (Join-Path $newSource 'node_modules')

        $stateDir = Get-OpenClawStateDir -Layout $Layout
        $dataDir = Get-DeployDataDir -Layout $Layout
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

        $manifestPath = Join-Path $newPkgDir.FullName 'manifest.json'
        $installedStatePath = Get-InstalledStatePath -Layout $Layout
        $needsInstall = $true
        $needsRebuild = $false
        $hasPrebuilt = $false

        if ((Test-Path -LiteralPath $manifestPath) -and (Test-Path -LiteralPath $installedStatePath)) {
            Write-DeployInfo 'Comparing versions...'
            $node = Get-NodeCommandPath
            $writeInstalledScript = Get-DeployScriptPath -Layout $Layout -ScriptName 'write-installed.js'
            $checkOutput = & $node $writeInstalledScript $dataDir --check $manifestPath 2>&1
            $outputLines = @($checkOutput | ForEach-Object { [string]$_ })
            foreach ($line in $outputLines) {
                if ($line -notmatch '__CHECK_RESULT__') {
                    Write-Host $line
                }
            }
            $checkResult = Convert-CheckOutputToResult -OutputLines $outputLines
            if ($checkResult) {
                $needsInstall = [bool]$checkResult.needsPnpmInstall
            }
        }

        $gatewayPrebuilt = Test-Path -LiteralPath (Join-Path $newSource 'dist\cli-startup-metadata.json')
        $deckPrebuilt = Test-Path -LiteralPath (Join-Path $newSource 'dashboard\.next\standalone\dashboard\server.js')
        if ($gatewayPrebuilt -and $deckPrebuilt) {
            $hasPrebuilt = $true
            $needsInstall = $false
            Write-DeployInfo 'Package includes prebuilt artifacts'
        } else {
            $needsRebuild = $true
            $needsInstall = $true
            Write-DeployInfo 'No prebuilt artifacts - will build from source'
        }

        $currentLockfile = Join-Path $Layout.SourceDir 'pnpm-lock.yaml'
        $newLockfile = Join-Path $newSource 'pnpm-lock.yaml'
        if ((Get-FileHashValue -Path $currentLockfile) -ne (Get-FileHashValue -Path $newLockfile)) {
            $needsInstall = $true
        }
        if ($packageHasNodeModules) {
            $needsInstall = $false
        }
        $currentEnvPath = Join-Path $Layout.DeployDir '.env'
        $newEnvExamplePath = Join-Path $newSource 'deploy\.env.example'
        $newVars = @()
        if ((Test-Path -LiteralPath $currentEnvPath) -and (Test-Path -LiteralPath $newEnvExamplePath)) {
            $newVars = @(Get-NewEnvVarNames -CurrentEnvPath $currentEnvPath -ExampleEnvPath $newEnvExamplePath)
        }

        if ($DryRun) {
            Write-DeployInfo '=== Dry Run Summary ==='
            Write-DeployInfo ('Package:      {0}' -f (Split-Path -Leaf $resolvedPackage))
            Write-DeployInfo ('Install deps: {0}' -f $needsInstall)
            Write-DeployInfo ('Rebuild:      {0}' -f $needsRebuild)
            Write-DeployInfo ('Has prebuilt: {0}' -f $hasPrebuilt)
            Write-DeployInfo ('Has node_modules: {0}' -f $packageHasNodeModules)
            Write-DeployInfo 'Will PRESERVE:'
            Write-DeployInfo '  deploy/.env'
            Write-DeployInfo '  data/ config, agents, sessions, cron, extensions, deck JSON'
            Write-DeployInfo 'Will REPLACE:'
            Write-DeployInfo '  Source code'
            if ($hasPrebuilt) {
                Write-DeployInfo '  Build output (prebuilt)'
            }
            Write-DeployInfo '  Deploy scripts'
            Write-DeployInfo 'Will MERGE (additive):'
            Write-DeployInfo '  openclaw.json / auth-profiles.json / skills'
            if ($newVars.Count -gt 0) {
                Write-DeployInfo 'New environment variables in this version:'
                foreach ($item in $newVars) {
                    Write-DeployInfo ('  {0}' -f $item)
                }
            }
            return
        }

        $backupStageDir = Join-Path $installParent (".update-backup-{0}" -f ([System.Guid]::NewGuid().ToString("N")))
        if (Test-Path -LiteralPath $backupStageDir) {
            Remove-Item -LiteralPath $backupStageDir -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $backupStageDir | Out-Null
        if (Test-Path -LiteralPath $installedStatePath) {
            Copy-Item -LiteralPath $installedStatePath -Destination (Join-Path $backupStageDir '.installed.json') -Force
        }
        $ecosystemPath = Join-Path $Layout.DeployDir 'ecosystem.config.cjs'
        if (Test-Path -LiteralPath $ecosystemPath) {
            Copy-Item -LiteralPath $ecosystemPath -Destination (Join-Path $backupStageDir 'ecosystem.config.cjs') -Force
        }
        $backupSourceArchive = Join-Path $backupStageDir 'install-root.tar.gz'
        $stagingBackupArchiveForTar = Convert-PathForTar -TarPath $tar -TargetPath $backupSourceArchive
        $installParentForTar = Convert-PathForTar -TarPath $tar -TargetPath (Split-Path -Parent $installRoot)
        $installLeaf = Split-Path -Leaf $installRoot
        Invoke-Checked -FilePath $tar -Arguments @(
            '-czf',
            $stagingBackupArchiveForTar,
            '-C',
            $installParentForTar,
            '--exclude',
            "$installLeaf/source/deploy/data",
            '--exclude',
            "$installLeaf/source/deploy/.backup",
            '--exclude',
            "$installLeaf/source/node_modules",
            $installLeaf
        ) -FailureMessage 'Failed to create upgrade backup'
        Write-DeployInfo ('Backup complete: {0}' -f $backupStageDir)

        Write-DeployInfo 'Stopping services...'
        Stop-DeployPm2Processes
        Stop-DeployServices

        $relocatedWorkingDirectory = $false
        $currentLocation = (Get-Location).Path
        if (
            -not [string]::IsNullOrWhiteSpace($currentLocation) -and
            $currentLocation.StartsWith($installRoot, [System.StringComparison]::OrdinalIgnoreCase)
        ) {
            Push-Location $installParent
            $relocatedWorkingDirectory = $true
        }

        Write-DeployInfo 'Replacing install root...'
        $previousRoot = Join-Path $installParent ((Split-Path -Leaf $installRoot) + '.previous')
        if (Test-Path -LiteralPath $previousRoot) {
            Remove-Item -LiteralPath $previousRoot -Recurse -Force
        }

        try {
            if (Test-Path -LiteralPath $installRoot) {
                Move-Item -LiteralPath $installRoot -Destination $previousRoot
            }
            Move-Item -LiteralPath $newPkgDir.FullName -Destination $installRoot
        } catch {
            if (-not (Test-Path -LiteralPath $installRoot) -and (Test-Path -LiteralPath $previousRoot)) {
                Move-Item -LiteralPath $previousRoot -Destination $installRoot
            }
            throw
        }

        $previousDataDir = Join-Path $previousRoot 'data'
        if (Test-Path -LiteralPath $previousDataDir) {
            Move-Item -LiteralPath $previousDataDir -Destination (Join-Path $installRoot 'data')
        }

        $previousEnvPath = Join-Path $previousRoot 'source\deploy\.env'
        if (Test-Path -LiteralPath $previousEnvPath) {
            $envParent = Split-Path -Parent $currentEnvPath
            New-Item -ItemType Directory -Force -Path $envParent | Out-Null
            Move-Item -LiteralPath $previousEnvPath -Destination $currentEnvPath
        }

        if (-not $needsInstall -and -not $packageHasNodeModules) {
            $previousNodeModules = Join-Path $previousRoot 'source\node_modules'
            $currentNodeModules = Join-Path $Layout.SourceDir 'node_modules'
            if (Test-Path -LiteralPath $previousNodeModules) {
                $nodeModulesParent = Split-Path -Parent $currentNodeModules
                New-Item -ItemType Directory -Force -Path $nodeModulesParent | Out-Null
                Move-Item -LiteralPath $previousNodeModules -Destination $currentNodeModules
            }
        }

        $backupDir = Join-Path $Layout.DeployDir '.backup'
        if (Test-Path -LiteralPath $backupDir) {
            Remove-Item -LiteralPath $backupDir -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        Get-ChildItem -LiteralPath $backupStageDir -Force | Copy-Item -Destination $backupDir -Recurse -Force

        if ($needsInstall) {
            Write-DeployInfo 'Installing dependencies...'
            Install-PnpmDependenciesWithFallback -Layout $Layout -FailureMessage 'Failed to install dependencies during upgrade'
        }

        if ($needsRebuild) {
            Write-DeployInfo 'Building Gateway...'
            Invoke-PnpmInSource -Layout $Layout -Arguments @('build') -FailureMessage 'Failed to build Gateway during upgrade'

            Write-DeployInfo 'Building Deck...'
            $dashboardDir = Join-Path $Layout.SourceDir 'dashboard'
            Push-Location $dashboardDir
            try {
                $pnpm = Get-PnpmCommandPath
                Invoke-Checked -FilePath $pnpm -Arguments @('install') -FailureMessage 'Failed to install dashboard dependencies during upgrade'
                $npx = Resolve-CommandPath -Candidates @('npx.cmd', 'npx.exe', 'npx')
                if (-not $npx) {
                    Write-DeployError 'npx not found on PATH'
                }
                Invoke-Checked -FilePath $npx -Arguments @('next', 'build', '--webpack') -FailureMessage 'Failed to build Deck during upgrade'
            } finally {
                Pop-Location
            }
        }

        Copy-DeckStandaloneAssets -Layout $Layout
        Invoke-NodeDeployScript -Layout $Layout -ScriptName 'seed.js' -Arguments @($stateDir) -FailureMessage 'Failed to run additive seed'

        Write-DeployInfo 'Starting services...'
        Install-DeployService -Layout $Layout | Out-Null
        Write-InstalledState -Layout $Layout

        if ($newVars.Count -gt 0) {
            Write-DeployInfo '=== New environment variables available ==='
            foreach ($item in $newVars) {
                Write-DeployInfo ('  {0}' -f $item)
            }
        }

        $gatewayPort = if ([string]::IsNullOrWhiteSpace($env:GATEWAY_PORT)) { '18789' } else { $env:GATEWAY_PORT }
        $deckPort = if ([string]::IsNullOrWhiteSpace($env:DECK_PORT)) { '3000' } else { $env:DECK_PORT }
        Write-DeployInfo '=== Upgrade complete ==='
        Write-DeployInfo ('Backup: {0}' -f $backupDir)
        Write-DeployInfo ('Gateway: http://localhost:{0}' -f $gatewayPort)
        Write-DeployInfo ('Deck:    http://localhost:{0}' -f $deckPort)
        $rollbackScriptPath = Join-Path $Layout.DeployDir 'install.ps1'
        Write-DeployInfo ('Rollback: powershell -ExecutionPolicy Bypass -File {0} -Rollback' -f $rollbackScriptPath)
        if (Test-Path -LiteralPath $previousRoot) {
            Remove-Item -LiteralPath $previousRoot -Recurse -Force
        }
        Pop-TarSupportPath -OriginalPath $originalTarPath
    } finally {
        if (Get-Variable -Name relocatedWorkingDirectory -ErrorAction SilentlyContinue) {
            if ($relocatedWorkingDirectory) {
                Pop-Location
            }
        }
        Pop-TarSupportPath -OriginalPath $originalGitPath
        if (Test-Path -LiteralPath $tempDir) {
            Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Invoke-DeployRollback {
    param([Parameter(Mandatory = $true)]$Layout)

    if (-not $Layout.IsPackagedInstall) {
        Write-DeployError 'Rollback is only supported from extracted deploy packages.'
    }

    Ensure-ExecutionPolicyForProcess
    Install-NodeIfNeeded
    Ensure-PnpmIfNeeded
    Import-DeployEnvironment -Layout $Layout | Out-Null
    $originalGitPath = Push-GitBashSupportPath

    $backupDir = Join-Path $Layout.DeployDir '.backup'
    $backupSourceArchive = Join-Path $backupDir 'install-root.tar.gz'
    if (-not (Test-Path -LiteralPath $backupDir) -or -not (Test-Path -LiteralPath $backupSourceArchive)) {
        Write-DeployError ('No backup found at {0}' -f $backupDir)
    }

    $installRoot = $Layout.PackageRoot
    $installParent = Split-Path -Parent $installRoot
    $rollbackStageDir = Join-Path $installParent (".rollback-stage-{0}" -f ([System.Guid]::NewGuid().ToString("N")))
    New-Item -ItemType Directory -Force -Path $rollbackStageDir | Out-Null
    $stagedBackupArchive = Join-Path $rollbackStageDir 'install-root.tar.gz'
    Copy-Item -LiteralPath $backupSourceArchive -Destination $stagedBackupArchive -Force

    $backupInstalledState = Join-Path $backupDir '.installed.json'
    $stagedInstalledState = Join-Path $rollbackStageDir '.installed.json'
    if (Test-Path -LiteralPath $backupInstalledState) {
        Copy-Item -LiteralPath $backupInstalledState -Destination $stagedInstalledState -Force
    }

    $backupEcosystem = Join-Path $backupDir 'ecosystem.config.cjs'
    $stagedEcosystem = Join-Path $rollbackStageDir 'ecosystem.config.cjs'
    if (Test-Path -LiteralPath $backupEcosystem) {
        Copy-Item -LiteralPath $backupEcosystem -Destination $stagedEcosystem -Force
    }

    $tar = Get-TarCommandPath
    if (-not $tar) {
        Write-DeployError 'tar not found on PATH'
    }
    $originalTarPath = Push-TarSupportPath -TarPath $tar
    $backupSourceArchiveForTar = Convert-PathForTar -TarPath $tar -TargetPath $stagedBackupArchive
    $installParentForTar = Convert-PathForTar -TarPath $tar -TargetPath (Split-Path -Parent $installRoot)

    try {
        Write-DeployInfo 'Rolling back to previous version...'
        Stop-DeployServices

        $relocatedWorkingDirectory = $false
        $currentLocation = (Get-Location).Path
        if (
            -not [string]::IsNullOrWhiteSpace($currentLocation) -and
            $currentLocation.StartsWith($installRoot, [System.StringComparison]::OrdinalIgnoreCase)
        ) {
            Push-Location $installParent
            $relocatedWorkingDirectory = $true
        }

        if (Test-Path -LiteralPath $installRoot) {
            Remove-Item -LiteralPath $installRoot -Recurse -Force
        }
        Invoke-Checked -FilePath $tar -Arguments @('-xzf', $backupSourceArchiveForTar, '-C', $installParentForTar) -FailureMessage 'Failed to restore source backup'

        if (Test-Path -LiteralPath $stagedInstalledState) {
            Copy-Item -LiteralPath $stagedInstalledState -Destination (Get-InstalledStatePath -Layout $Layout) -Force
        }
        if (Test-Path -LiteralPath $stagedEcosystem) {
            $ecosystemPath = Join-Path $Layout.DeployDir 'ecosystem.config.cjs'
            Copy-Item -LiteralPath $stagedEcosystem -Destination $ecosystemPath -Force
        }

        Install-DeployService -Layout $Layout | Out-Null
        Write-DeployInfo '=== Rollback complete ==='
        $statusScriptPath = Join-Path $Layout.DeployDir 'status.ps1'
        Write-DeployInfo ('Run: powershell -ExecutionPolicy Bypass -File {0}' -f $statusScriptPath)
    } finally {
        if (Get-Variable -Name relocatedWorkingDirectory -ErrorAction SilentlyContinue) {
            if ($relocatedWorkingDirectory) {
                Pop-Location
            }
        }
        Pop-TarSupportPath -OriginalPath $originalTarPath
        Pop-TarSupportPath -OriginalPath $originalGitPath
        if (Test-Path -LiteralPath $rollbackStageDir) {
            Remove-Item -LiteralPath $rollbackStageDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Show-InstallHelp {
    param([Parameter(Mandatory = $true)]$Layout)

    $installPath = Join-Path $Layout.DeployDir 'install.ps1'
    Write-Host 'Usage:'
    Write-Host ('  powershell -ExecutionPolicy Bypass -File {0}' -f $installPath)
    Write-Host ('  powershell -ExecutionPolicy Bypass -File {0} -UpgradePackage package.tar.gz [-DryRun]' -f $installPath)
    Write-Host ('  powershell -ExecutionPolicy Bypass -File {0} -Rollback' -f $installPath)
    Write-Host ('  powershell -ExecutionPolicy Bypass -File {0} -Status' -f $installPath)
    Write-Host ''
    Write-Host 'This PowerShell path currently supports Windows bare-metal installs only.'
}
