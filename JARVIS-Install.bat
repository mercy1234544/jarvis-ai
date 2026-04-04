@echo off
title JARVIS Installer
color 0B
:: ============================================================
::  J.A.R.V.I.S. One-File Installer
::  github.com/mercy1234544/jarvis-ai
:: ============================================================

:: Request admin elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  Requesting administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c \""%~f0\""' -Verb RunAs"
    exit /b
)

:: Write the VBScript helper to temp
set "VBSHELPER=%TEMP%\jarvis_writer.vbs"
set "PS1FILE=%TEMP%\jarvis_setup.ps1"

:: Delete old files if they exist
if exist "%VBSHELPER%" del /f /q "%VBSHELPER%"
if exist "%PS1FILE%" del /f /q "%PS1FILE%"

:: Write the VBScript writer (each line echoed)
echo Dim fso, f>>"%VBSHELPER%"
echo Set fso = CreateObject("Scripting.FileSystemObject")>>"%VBSHELPER%"
echo Set f = fso.CreateTextFile(WScript.Arguments(0), True, False)>>"%VBSHELPER%"
echo f.WriteLine "$ErrorActionPreference = 'Stop'">>"%VBSHELPER%"
echo f.WriteLine "$ProgressPreference = 'SilentlyContinue'">>"%VBSHELPER%"
echo f.WriteLine "$Host.UI.RawUI.WindowTitle = 'JARVIS Installer'">>"%VBSHELPER%"
echo f.WriteLine "$INSTALL_DIR = Join-Path $env:USERPROFILE 'JARVIS'">>"%VBSHELPER%"
echo f.WriteLine "$REPO        = 'https://github.com/mercy1234544/jarvis-ai.git'">>"%VBSHELPER%"
echo f.WriteLine "$NODE_MSI    = 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi'">>"%VBSHELPER%"
echo f.WriteLine "$GIT_EXE     = 'https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe'">>"%VBSHELPER%"
echo f.WriteLine "function Banner {">>"%VBSHELPER%"
echo f.WriteLine "    Clear-Host">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host '  ============================================================' -ForegroundColor Cyan">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host '   J.A.R.V.I.S. - Just A Rather Very Intelligent System' -ForegroundColor White">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host '   One-File Installer' -ForegroundColor Cyan">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host '  ============================================================' -ForegroundColor Cyan">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host ''">>"%VBSHELPER%"
echo f.WriteLine "}">>"%VBSHELPER%"
echo f.WriteLine "function Step { param($n,$m) Write-Host ""  [$n/6] $m"" -ForegroundColor Cyan }">>"%VBSHELPER%"
echo f.WriteLine "function OK   { param($m) Write-Host ""  [OK] $m"" -ForegroundColor Green }">>"%VBSHELPER%"
echo f.WriteLine "function WARN { param($m) Write-Host ""  [!!] $m"" -ForegroundColor Yellow }">>"%VBSHELPER%"
echo f.WriteLine "function INFO { param($m) Write-Host ""       $m"" -ForegroundColor Gray }">>"%VBSHELPER%"
echo f.WriteLine "function FAIL { param($m)">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host ""  [XX] $m"" -ForegroundColor Red">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host ''">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host '  Press Enter to exit...' -ForegroundColor DarkGray">>"%VBSHELPER%"
echo f.WriteLine "    Read-Host">>"%VBSHELPER%"
echo f.WriteLine "    exit 1">>"%VBSHELPER%"
echo f.WriteLine "}">>"%VBSHELPER%"
echo f.WriteLine "function RefreshPath {">>"%VBSHELPER%"
echo f.WriteLine "    $m = [System.Environment]::GetEnvironmentVariable('PATH','Machine')">>"%VBSHELPER%"
echo f.WriteLine "    $u = [System.Environment]::GetEnvironmentVariable('PATH','User')">>"%VBSHELPER%"
echo f.WriteLine "    $env:PATH = $m + ';' + $u">>"%VBSHELPER%"
echo f.WriteLine "}">>"%VBSHELPER%"
echo f.WriteLine "Banner">>"%VBSHELPER%"
echo f.WriteLine "Step 1 'Checking for Git...'">>"%VBSHELPER%"
echo f.WriteLine "RefreshPath">>"%VBSHELPER%"
echo f.WriteLine "$git = Get-Command git -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "if (-not $git) {">>"%VBSHELPER%"
echo f.WriteLine "    WARN 'Git not found. Downloading Git for Windows (~50 MB)...'">>"%VBSHELPER%"
echo f.WriteLine "    $tmp = Join-Path $env:TEMP 'git-setup.exe'">>"%VBSHELPER%"
echo f.WriteLine "    try {">>"%VBSHELPER%"
echo f.WriteLine "        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12">>"%VBSHELPER%"
echo f.WriteLine "        (New-Object System.Net.WebClient).DownloadFile($GIT_EXE, $tmp)">>"%VBSHELPER%"
echo f.WriteLine "        INFO 'Installing Git silently...'">>"%VBSHELPER%"
echo f.WriteLine "        Start-Process $tmp -ArgumentList '/VERYSILENT /NORESTART /NOCANCEL /SP-' -Wait">>"%VBSHELPER%"
echo f.WriteLine "        RefreshPath">>"%VBSHELPER%"
echo f.WriteLine "        $git = Get-Command git -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "        if ($git) { OK 'Git installed successfully!' }">>"%VBSHELPER%"
echo f.WriteLine "        else { FAIL 'Git install failed. Install from https://git-scm.com and re-run.' }">>"%VBSHELPER%"
echo f.WriteLine "    } catch { FAIL ('Git download failed: ' + $_.Exception.Message) }">>"%VBSHELPER%"
echo f.WriteLine "} else { OK ('Git found: ' + (git --version)) }">>"%VBSHELPER%"
echo f.WriteLine "Step 2 'Checking for Node.js...'">>"%VBSHELPER%"
echo f.WriteLine "RefreshPath">>"%VBSHELPER%"
echo f.WriteLine "$node = Get-Command node -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "if (-not $node) {">>"%VBSHELPER%"
echo f.WriteLine "    WARN 'Node.js not found. Installing Node.js v20 LTS...'">>"%VBSHELPER%"
echo f.WriteLine "    $installed = $false">>"%VBSHELPER%"
echo f.WriteLine "    $wg = Get-Command winget -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "    if ($wg) {">>"%VBSHELPER%"
echo f.WriteLine "        INFO 'Trying winget...'">>"%VBSHELPER%"
echo f.WriteLine "        try {">>"%VBSHELPER%"
echo f.WriteLine "            Start-Process winget -ArgumentList 'install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements' -Wait -NoNewWindow">>"%VBSHELPER%"
echo f.WriteLine "            RefreshPath">>"%VBSHELPER%"
echo f.WriteLine "            $node = Get-Command node -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "            if ($node) { $installed = $true; OK 'Node.js installed via winget!' }">>"%VBSHELPER%"
echo f.WriteLine "        } catch {}">>"%VBSHELPER%"
echo f.WriteLine "    }">>"%VBSHELPER%"
echo f.WriteLine "    if (-not $installed) {">>"%VBSHELPER%"
echo f.WriteLine "        INFO 'Downloading Node.js MSI (~30 MB)...'">>"%VBSHELPER%"
echo f.WriteLine "        $tmp = Join-Path $env:TEMP 'node-setup.msi'">>"%VBSHELPER%"
echo f.WriteLine "        try {">>"%VBSHELPER%"
echo f.WriteLine "            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12">>"%VBSHELPER%"
echo f.WriteLine "            (New-Object System.Net.WebClient).DownloadFile($NODE_MSI, $tmp)">>"%VBSHELPER%"
echo f.WriteLine "            INFO 'Installing Node.js...'">>"%VBSHELPER%"
echo f.WriteLine "            Start-Process msiexec -ArgumentList ""/i `""$tmp`"" /qn /norestart"" -Wait -Verb RunAs">>"%VBSHELPER%"
echo f.WriteLine "            RefreshPath">>"%VBSHELPER%"
echo f.WriteLine "            $node = Get-Command node -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "            if ($node) { $installed = $true; OK 'Node.js installed!' }">>"%VBSHELPER%"
echo f.WriteLine "        } catch { FAIL ('Node.js install failed: ' + $_.Exception.Message) }">>"%VBSHELPER%"
echo f.WriteLine "    }">>"%VBSHELPER%"
echo f.WriteLine "    if (-not $installed) { FAIL 'Could not install Node.js. Please install from https://nodejs.org and re-run.' }">>"%VBSHELPER%"
echo f.WriteLine "} else { OK ('Node.js found: ' + (node --version)) }">>"%VBSHELPER%"
echo f.WriteLine "Step 3 'Downloading JARVIS files...'">>"%VBSHELPER%"
echo f.WriteLine "if (Test-Path (Join-Path $INSTALL_DIR '.git')) {">>"%VBSHELPER%"
echo f.WriteLine "    INFO 'JARVIS already installed. Pulling latest update...'">>"%VBSHELPER%"
echo f.WriteLine "    Set-Location $INSTALL_DIR">>"%VBSHELPER%"
echo f.WriteLine "    try {">>"%VBSHELPER%"
echo f.WriteLine "        git fetch --all">>"%VBSHELPER%"
echo f.WriteLine "        git reset --hard origin/main">>"%VBSHELPER%"
echo f.WriteLine "        OK 'JARVIS updated!'">>"%VBSHELPER%"
echo f.WriteLine "    } catch { WARN 'Update failed, continuing with existing files.' }">>"%VBSHELPER%"
echo f.WriteLine "} else {">>"%VBSHELPER%"
echo f.WriteLine "    if (Test-Path $INSTALL_DIR) { Remove-Item $INSTALL_DIR -Recurse -Force }">>"%VBSHELPER%"
echo f.WriteLine "    INFO ('Cloning to ' + $INSTALL_DIR + '...')">>"%VBSHELPER%"
echo f.WriteLine "    try {">>"%VBSHELPER%"
echo f.WriteLine "        git clone $REPO $INSTALL_DIR">>"%VBSHELPER%"
echo f.WriteLine "        OK 'JARVIS files downloaded!'">>"%VBSHELPER%"
echo f.WriteLine "    } catch { FAIL ('Download failed: ' + $_.Exception.Message) }">>"%VBSHELPER%"
echo f.WriteLine "}">>"%VBSHELPER%"
echo f.WriteLine "Step 4 'Installing dependencies (1-2 min first time)...'">>"%VBSHELPER%"
echo f.WriteLine "Set-Location $INSTALL_DIR">>"%VBSHELPER%"
echo f.WriteLine "RefreshPath">>"%VBSHELPER%"
echo f.WriteLine "$npmCmd = Get-Command npm -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "if (-not $npmCmd) { FAIL 'npm not found. Please restart this installer after Node.js installed.' }">>"%VBSHELPER%"
echo f.WriteLine "npm install --no-fund --no-audit">>"%VBSHELPER%"
echo f.WriteLine "if ($LASTEXITCODE -ne 0) { FAIL 'npm install failed. Check output above.' }">>"%VBSHELPER%"
echo f.WriteLine "OK 'All dependencies installed!'">>"%VBSHELPER%"
echo f.WriteLine "Step 5 'Setting up JARVIS voice...'">>"%VBSHELPER%"
echo f.WriteLine "try {">>"%VBSHELPER%"
echo f.WriteLine "    $langPkg = Get-WindowsCapability -Online -ErrorAction SilentlyContinue ^| Where-Object { $_.Name -like '*Language.Speech*en-GB*' }">>"%VBSHELPER%"
echo f.WriteLine "    if ($langPkg -and $langPkg.State -ne 'Installed') {">>"%VBSHELPER%"
echo f.WriteLine "        Add-WindowsCapability -Online -Name $langPkg.Name -ErrorAction SilentlyContinue">>"%VBSHELPER%"
echo f.WriteLine "        OK 'British voice installed!'">>"%VBSHELPER%"
echo f.WriteLine "    } else { OK 'Voice ready.' }">>"%VBSHELPER%"
echo f.WriteLine "} catch { OK 'Voice setup skipped.' }">>"%VBSHELPER%"
echo f.WriteLine "Step 6 'Creating shortcuts...'">>"%VBSHELPER%"
echo f.WriteLine "$vbs = Join-Path $INSTALL_DIR 'JARVIS.vbs'">>"%VBSHELPER%"
echo f.WriteLine "$nl = [System.Environment]::NewLine">>"%VBSHELPER%"
echo f.WriteLine "$vbsText  = 'Set WS = CreateObject(""WScript.Shell"")' + $nl">>"%VBSHELPER%"
echo f.WriteLine "$vbsText += 'WS.CurrentDirectory = ""' + $INSTALL_DIR + '""' + $nl">>"%VBSHELPER%"
echo f.WriteLine "$vbsText += 'WS.Run ""cmd /c node_modules\.bin\electron.cmd . --no-sandbox"", 0, False' + $nl">>"%VBSHELPER%"
echo f.WriteLine "$vbsText += 'Set WS = Nothing'">>"%VBSHELPER%"
echo f.WriteLine "[System.IO.File]::WriteAllBytes($vbs, [System.Text.Encoding]::ASCII.GetBytes($vbsText))">>"%VBSHELPER%"
echo f.WriteLine "$wsh = New-Object -ComObject WScript.Shell">>"%VBSHELPER%"
echo f.WriteLine "$ico = Join-Path $INSTALL_DIR 'assets\icons\jarvis.ico'">>"%VBSHELPER%"
echo f.WriteLine "$desk = [Environment]::GetFolderPath('Desktop')">>"%VBSHELPER%"
echo f.WriteLine "$sc = $wsh.CreateShortcut((Join-Path $desk 'JARVIS.lnk'))">>"%VBSHELPER%"
echo f.WriteLine "$sc.TargetPath = 'wscript.exe'">>"%VBSHELPER%"
echo f.WriteLine "$sc.Arguments = '""' + $vbs + '""'">>"%VBSHELPER%"
echo f.WriteLine "$sc.WorkingDirectory = $INSTALL_DIR">>"%VBSHELPER%"
echo f.WriteLine "$sc.Description = 'JARVIS AI Desktop Assistant'">>"%VBSHELPER%"
echo f.WriteLine "if (Test-Path $ico) { $sc.IconLocation = $ico }">>"%VBSHELPER%"
echo f.WriteLine "$sc.Save()">>"%VBSHELPER%"
echo f.WriteLine "$sm = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'">>"%VBSHELPER%"
echo f.WriteLine "$sc2 = $wsh.CreateShortcut((Join-Path $sm 'JARVIS.lnk'))">>"%VBSHELPER%"
echo f.WriteLine "$sc2.TargetPath = 'wscript.exe'">>"%VBSHELPER%"
echo f.WriteLine "$sc2.Arguments = '""' + $vbs + '""'">>"%VBSHELPER%"
echo f.WriteLine "$sc2.WorkingDirectory = $INSTALL_DIR">>"%VBSHELPER%"
echo f.WriteLine "$sc2.Description = 'JARVIS AI Desktop Assistant'">>"%VBSHELPER%"
echo f.WriteLine "if (Test-Path $ico) { $sc2.IconLocation = $ico }">>"%VBSHELPER%"
echo f.WriteLine "$sc2.Save()">>"%VBSHELPER%"
echo f.WriteLine "OK 'Shortcuts created!'">>"%VBSHELPER%"
echo f.WriteLine "Write-Host ''">>"%VBSHELPER%"
echo f.WriteLine "Write-Host '  ============================================================' -ForegroundColor Green">>"%VBSHELPER%"
echo f.WriteLine "Write-Host '   JARVIS INSTALLATION COMPLETE!' -ForegroundColor Green">>"%VBSHELPER%"
echo f.WriteLine "Write-Host '  ============================================================' -ForegroundColor Green">>"%VBSHELPER%"
echo f.WriteLine "Write-Host ''">>"%VBSHELPER%"
echo f.WriteLine "Write-Host ""   Installed to: $INSTALL_DIR"" -ForegroundColor Cyan">>"%VBSHELPER%"
echo f.WriteLine "Write-Host '   Double-click JARVIS on your Desktop to launch!' -ForegroundColor Cyan">>"%VBSHELPER%"
echo f.WriteLine "Write-Host '   TIP: Add ElevenLabs key in Settings for real JARVIS voice!' -ForegroundColor Yellow">>"%VBSHELPER%"
echo f.WriteLine "Write-Host ''">>"%VBSHELPER%"
echo f.WriteLine "$ans = Read-Host '  Launch JARVIS now? (Y/N)'">>"%VBSHELPER%"
echo f.WriteLine "if ($ans -match '^^[Yy]') {">>"%VBSHELPER%"
echo f.WriteLine "    Start-Process 'wscript.exe' -ArgumentList ('""' + $vbs + '""')">>"%VBSHELPER%"
echo f.WriteLine "    Write-Host '  JARVIS is starting!' -ForegroundColor Green">>"%VBSHELPER%"
echo f.WriteLine "}">>"%VBSHELPER%"
echo f.WriteLine "Write-Host ''">>"%VBSHELPER%"
echo f.WriteLine "Write-Host '  Press any key to close...' -ForegroundColor DarkGray">>"%VBSHELPER%"
echo f.WriteLine "$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')">>"%VBSHELPER%"
echo f.WriteLine "">>"%VBSHELPER%"
echo f.Close>>"%VBSHELPER%"
echo Set f = Nothing>>"%VBSHELPER%"
echo Set fso = Nothing>>"%VBSHELPER%"

:: Use the VBScript to write the PS1 file
cscript //nologo "%VBSHELPER%" "%PS1FILE%"
if %errorlevel% neq 0 (
    echo  ERROR: Could not write installer script.
    pause
    exit /b 1
)

:: Run the PS1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1FILE%"

if %errorlevel% neq 0 (
    echo.
    echo   Installation encountered an error.
    pause
)

:: Cleanup
if exist "%VBSHELPER%" del /f /q "%VBSHELPER%"
if exist "%PS1FILE%" del /f /q "%PS1FILE%"
