Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-DeployWindowsTaskName {
    param([Parameter(Mandatory = $true)]$Layout)

    if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_DEPLOY_WINDOWS_TASK_NAME)) {
        return $env:OPENCLAW_DEPLOY_WINDOWS_TASK_NAME
    }
    return "OpenClaw Deploy"
}

function Get-DeployServiceDescription {
    return "OpenClaw Deploy (Gateway + Deck)"
}

function Get-DeployRuntimeDir {
    param([Parameter(Mandatory = $true)]$Layout)
    return Join-Path (Get-DeployDataDir -Layout $Layout) ".windows-runtime"
}

function Get-DeployLogsDir {
    param([Parameter(Mandatory = $true)]$Layout)
    return Join-Path (Get-DeployDataDir -Layout $Layout) "logs"
}

function Get-DeploySupervisorStatePath {
    param([Parameter(Mandatory = $true)]$Layout)
    return Join-Path (Get-DeployRuntimeDir -Layout $Layout) "supervisor-state.json"
}

function Get-DeployLauncherScriptPath {
    param([Parameter(Mandatory = $true)]$Layout)
    return Join-Path (Get-DeployRuntimeDir -Layout $Layout) "openclaw-deploy.cmd"
}

function Resolve-WindowsStartupDirectory {
    if (-not [string]::IsNullOrWhiteSpace($env:APPDATA)) {
        return Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
    }
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        return Join-Path $env:USERPROFILE "AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup"
    }
    Write-DeployError "Windows startup folder unavailable: APPDATA/USERPROFILE not set"
}

function Get-DeployStartupEntryPath {
    param([Parameter(Mandatory = $true)]$Layout)

    $taskName = Get-DeployWindowsTaskName -Layout $Layout
    $safeName = ($taskName -replace '[<>:"/\\|?*]', '_') -replace '\p{Cc}', '_'
    return Join-Path (Resolve-WindowsStartupDirectory) ("{0}.cmd" -f $safeName)
}

function Quote-CmdScriptArg {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    return '"{0}"' -f ($Value -replace '"', '""')
}

function Quote-SchtasksArg {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    return '"{0}"' -f ($Value -replace '"', '\\"')
}

function Parse-KeyValueOutput {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [AllowEmptyString()]
        [string[]]$Lines
    )

    $result = @{}
    foreach ($line in $Lines) {
        $index = $line.IndexOf(':')
        if ($index -lt 1) {
            continue
        }
        $key = $line.Substring(0, $index).Trim().ToLowerInvariant()
        $value = $line.Substring($index + 1).Trim()
        if (-not $result.ContainsKey($key)) {
            $result[$key] = $value
        }
    }
    return $result
}

function Invoke-Schtasks {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $schtasks = Resolve-CommandPath -Candidates @("schtasks.exe", "schtasks")
    if (-not $schtasks) {
        return [pscustomobject]@{ Code = 1; Lines = @("schtasks not found"); Text = "schtasks not found" }
    }

    $stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-schtasks-{0}.out" -f ([System.Guid]::NewGuid().ToString('N')))
    $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-schtasks-{0}.err" -f ([System.Guid]::NewGuid().ToString('N')))
    try {
        $process = Start-Process -FilePath $schtasks -ArgumentList $Arguments -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        $lines = @()
        if (Test-Path -LiteralPath $stdoutPath) {
            $lines += Get-Content -LiteralPath $stdoutPath
        }
        if (Test-Path -LiteralPath $stderrPath) {
            $lines += Get-Content -LiteralPath $stderrPath
        }
        return [pscustomobject]@{
        Code = $process.ExitCode
        Lines = $lines
        Text = ($lines -join "`n")
        }
    } finally {
        Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
    }
}

function Test-SchtasksAvailable {
    $result = Invoke-Schtasks -Arguments @("/Query")
    return $result.Code -eq 0
}

function Get-DeployTaskUser {
    if (-not [string]::IsNullOrWhiteSpace($env:USERNAME)) {
        if (-not [string]::IsNullOrWhiteSpace($env:USERDOMAIN)) {
            return "{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME
        }
        return $env:USERNAME
    }
    return $null
}

function Should-FallbackToStartupEntry {
    param(
        [Parameter(Mandatory = $true)][int]$Code,
        [Parameter(Mandatory = $true)][string]$Detail
    )

    return ($Code -ne 0)
}

function Build-DeployLauncherScript {
    param([Parameter(Mandatory = $true)]$Layout)

    $nodePath = Get-NodeCommandPath
    if (-not $nodePath) {
        Write-DeployError "node not found on PATH"
    }

    $supervisorScript = Join-Path $Layout.DeployDir "scripts\windows\supervisor.mjs"
    $runtimeDir = Get-DeployRuntimeDir -Layout $Layout
    $lines = @(
        '@echo off',
        ('rem {0}' -f (Get-DeployServiceDescription)),
        ('cd /d {0}' -f (Quote-CmdScriptArg $Layout.SourceDir)),
        ':_openclaw_deploy_restart',
        ('{0} {1} --deploy-dir {2} --source-dir {3} --runtime-dir {4}' -f
            (Quote-CmdScriptArg $nodePath),
            (Quote-CmdScriptArg $supervisorScript),
            (Quote-CmdScriptArg $Layout.DeployDir),
            (Quote-CmdScriptArg $Layout.SourceDir),
            (Quote-CmdScriptArg $runtimeDir)),
        'if %errorlevel% equ 0 goto _openclaw_deploy_exit',
        'timeout /t 5 /nobreak >nul 2>nul',
        'goto _openclaw_deploy_restart',
        ':_openclaw_deploy_exit'
    )
    return ($lines -join "`r`n") + "`r`n"
}

function Build-StartupLauncherScript {
    param([Parameter(Mandatory = $true)][string]$LauncherScriptPath)

    $lines = @(
        '@echo off',
        ('rem {0}' -f (Get-DeployServiceDescription)),
        ('start "" /min cmd.exe /d /c {0}' -f (Quote-CmdScriptArg $LauncherScriptPath))
    )
    return ($lines -join "`r`n") + "`r`n"
}

function Test-RegisteredScheduledTask {
    param([Parameter(Mandatory = $true)]$Layout)

    $taskName = Get-DeployWindowsTaskName -Layout $Layout
    $result = Invoke-Schtasks -Arguments @("/Query", "/TN", (Quote-SchtasksArg $taskName))
    return $result.Code -eq 0
}

function Test-StartupEntryInstalled {
    param([Parameter(Mandatory = $true)]$Layout)
    return Test-Path -LiteralPath (Get-DeployStartupEntryPath -Layout $Layout)
}

function Launch-DeployLauncher {
    param([Parameter(Mandatory = $true)][string]$LauncherPath)

    Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/s", "/c", (Quote-CmdScriptArg $LauncherPath)) -WindowStyle Hidden | Out-Null
}

function Read-DeploySupervisorState {
    param([Parameter(Mandatory = $true)]$Layout)

    $statePath = Get-DeploySupervisorStatePath -Layout $Layout
    if (-not (Test-Path -LiteralPath $statePath)) {
        return $null
    }
    try {
        return (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Stop-ProcessTreeById {
    param([Parameter(Mandatory = $true)][int]$TargetPid)

    if ($TargetPid -le 0) {
        return
    }

    $taskkill = Resolve-CommandPath -Candidates @("taskkill.exe", "taskkill")
    if ($taskkill) {
        $cmd = Resolve-CommandPath -Candidates @('cmd.exe', 'cmd')
        if ($cmd) {
            try {
                & $cmd /d /c "`"$taskkill`" /PID $TargetPid /T /F >nul 2>nul" | Out-Null
            } catch {}
        } else {
            try {
                & $taskkill /PID $TargetPid /T /F 2>$null | Out-Null
            } catch {}
        }
        return
    }

    try {
        Stop-Process -Id $TargetPid -Force -ErrorAction Stop
    } catch {}
}

function Stop-DeployRuntimeProcesses {
    param([Parameter(Mandatory = $true)]$Layout)

    $state = Read-DeploySupervisorState -Layout $Layout
    if ($null -eq $state) {
        return
    }

    $pids = New-Object System.Collections.Generic.List[int]
    foreach ($value in @($state.supervisorPid, $state.gatewayPid, $state.deckPid)) {
        $parsedPid = 0
        if ($null -ne $value -and [int]::TryParse([string]$value, [ref]$parsedPid) -and $parsedPid -gt 0 -and -not $pids.Contains($parsedPid)) {
            [void]$pids.Add($parsedPid)
        }
    }

    foreach ($processId in $pids) {
        Stop-ProcessTreeById -TargetPid $processId
    }

    $statePath = Get-DeploySupervisorStatePath -Layout $Layout
    if (Test-Path -LiteralPath $statePath) {
        Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    }
}

function Stop-DeployProcessesByCommandLine {
    param([Parameter(Mandatory = $true)]$Layout)

    $markers = @(
        $Layout.PackageRoot,
        (Join-Path $Layout.SourceDir 'openclaw.mjs'),
        (Join-Path $Layout.SourceDir 'dashboard\.next\standalone\dashboard\standalone-entry.mjs'),
        (Join-Path $Layout.DeployDir 'scripts\windows\supervisor.mjs'),
        (Get-DeployLauncherScriptPath -Layout $Layout)
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    $candidates = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = 'cmd.exe'" -ErrorAction SilentlyContinue
    if ($null -eq $candidates) {
        return
    }

    $seen = New-Object System.Collections.Generic.HashSet[int]
    foreach ($process in $candidates) {
        $processId = 0
        if (-not [int]::TryParse([string]$process.ProcessId, [ref]$processId)) {
            continue
        }
        if ($seen.Contains($processId)) {
            continue
        }
        $commandLine = [string]$process.CommandLine
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            continue
        }
        foreach ($marker in $markers) {
            if ($commandLine.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                [void]$seen.Add($processId)
                Stop-ProcessTreeById -TargetPid $processId
                break
            }
        }
    }
}

function Get-DeployServiceRegistrationInfo {
    param([Parameter(Mandatory = $true)]$Layout)

    $taskName = Get-DeployWindowsTaskName -Layout $Layout
    $taskResult = Invoke-Schtasks -Arguments @("/Query", "/TN", (Quote-SchtasksArg $taskName), "/V", "/FO", "LIST")
    if ($taskResult.Code -eq 0) {
        $parsed = Parse-KeyValueOutput -Lines $taskResult.Lines
        return [pscustomobject]@{
            Mode = "task"
            TaskName = $taskName
            TaskStatus = $parsed["status"]
            LastRunTime = $parsed["last run time"]
            LastRunResult = if ($parsed.ContainsKey("last run result")) { $parsed["last run result"] } else { $parsed["last result"] }
        }
    }

    $startupEntryPath = Get-DeployStartupEntryPath -Layout $Layout
    if (Test-Path -LiteralPath $startupEntryPath) {
        return [pscustomobject]@{
            Mode = "startup"
            TaskName = $taskName
            StartupEntryPath = $startupEntryPath
        }
    }

    return [pscustomobject]@{
        Mode = "none"
        TaskName = $taskName
    }
}

function Install-DeployService {
    param([Parameter(Mandatory = $true)]$Layout)

    $runtimeDir = Get-DeployRuntimeDir -Layout $Layout
    $logsDir = Get-DeployLogsDir -Layout $Layout
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

    $launcherPath = Get-DeployLauncherScriptPath -Layout $Layout
    Set-Content -LiteralPath $launcherPath -Value (Build-DeployLauncherScript -Layout $Layout) -Encoding ASCII -NoNewline

    $taskName = Get-DeployWindowsTaskName -Layout $Layout
    $taskUser = Get-DeployTaskUser

    if (Test-SchtasksAvailable) {
        $baseArgs = @(
            "/Create", "/F", "/SC", "ONLOGON", "/RL", "LIMITED",
            "/TN", (Quote-SchtasksArg $taskName),
            "/TR", (Quote-SchtasksArg $launcherPath)
        )
        # Prefer the simplest ONLOGON task shape first; `/IT` is fragile in
        # headless/SSH-admin flows and caused false fallback to Startup items on
        # the Windows release host even though Task Scheduler itself worked.
        $create = Invoke-Schtasks -Arguments $baseArgs
        if ($create.Code -ne 0 -and $null -ne $taskUser) {
            $create = Invoke-Schtasks -Arguments ($baseArgs + @("/RU", $taskUser, "/NP"))
        }
        if ($create.Code -eq 0) {
            $startupPath = Get-DeployStartupEntryPath -Layout $Layout
            if (Test-Path -LiteralPath $startupPath) {
                Remove-Item -LiteralPath $startupPath -Force -ErrorAction SilentlyContinue
            }
            [void](Invoke-Schtasks -Arguments @("/Run", "/TN", (Quote-SchtasksArg $taskName)))
            Write-DeployInfo ("Installed Scheduled Task: {0}" -f $taskName)
            Write-DeployInfo ("Launcher script: {0}" -f $launcherPath)
            return [pscustomobject]@{ Mode = "task"; LauncherPath = $launcherPath }
        }

        if (-not (Should-FallbackToStartupEntry -Code $create.Code -Detail $create.Text)) {
            Write-DeployError ("schtasks create failed: {0}" -f $create.Text)
        }
    }

    $startupEntryPath = Get-DeployStartupEntryPath -Layout $Layout
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $startupEntryPath) | Out-Null
    Set-Content -LiteralPath $startupEntryPath -Value (Build-StartupLauncherScript -LauncherScriptPath $launcherPath) -Encoding ASCII -NoNewline
    Launch-DeployLauncher -LauncherPath $launcherPath
    Write-DeployInfo ("Installed Windows login item: {0}" -f $startupEntryPath)
    Write-DeployInfo ("Launcher script: {0}" -f $launcherPath)
    return [pscustomobject]@{ Mode = "startup"; LauncherPath = $launcherPath; StartupEntryPath = $startupEntryPath }
}

function Start-DeployService {
    param([Parameter(Mandatory = $true)]$Layout)

    $registration = Get-DeployServiceRegistrationInfo -Layout $Layout
    if ($registration.Mode -eq "task") {
        [void](Invoke-Schtasks -Arguments @("/Run", "/TN", (Quote-SchtasksArg $registration.TaskName)))
        Write-DeployInfo ("Started Scheduled Task: {0}" -f $registration.TaskName)
        return
    }
    if ($registration.Mode -eq "startup") {
        Launch-DeployLauncher -LauncherPath (Get-DeployLauncherScriptPath -Layout $Layout)
        Write-DeployInfo ("Started Windows login item runtime: {0}" -f $registration.TaskName)
        return
    }
    Write-DeployError "No Windows deploy service is installed. Run install.ps1 first."
}

function Stop-DeployService {
    param([Parameter(Mandatory = $true)]$Layout)

    $registration = Get-DeployServiceRegistrationInfo -Layout $Layout
    if ($registration.Mode -eq "task") {
        [void](Invoke-Schtasks -Arguments @("/End", "/TN", (Quote-SchtasksArg $registration.TaskName)))
        Write-DeployInfo ("Stopped Scheduled Task: {0}" -f $registration.TaskName)
    } elseif ($registration.Mode -eq "startup") {
        Write-DeployInfo ("Stopping Windows login item runtime: {0}" -f $registration.TaskName)
    }

    Stop-DeployRuntimeProcesses -Layout $Layout
    Stop-DeployProcessesByCommandLine -Layout $Layout
}
