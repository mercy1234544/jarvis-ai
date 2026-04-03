@echo off
setlocal EnableDelayedExpansion
title JARVIS Installer
color 0B

:: ============================================================
::  J.A.R.V.I.S. ONE-FILE INSTALLER
::  Double-click this file on any Windows PC.
::  It installs Git, Node.js, clones the repo,
::  installs all dependencies, creates shortcuts,
::  and launches JARVIS. Nothing else needed.
:: ============================================================

echo.
echo   ============================================================
echo    J.A.R.V.I.S.  -  Just A Rather Very Intelligent System
echo    One-File Installer
echo   ============================================================
echo.

:: Run the embedded PowerShell installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
"& { $ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; ^
$INSTALL_DIR = Join-Path $env:USERPROFILE 'JARVIS'; ^
$REPO = 'https://github.com/mercy1234544/jarvis-ai.git'; ^
$NODE_URL = 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi'; ^
$GIT_URL = 'https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe'; ^
function W($m,$c='Cyan'){Write-Host '  '$m -ForegroundColor $c}; ^
function OK($m){Write-Host '  [OK] '$m -ForegroundColor Green}; ^
function ERR($m){Write-Host '  [!!] '$m -ForegroundColor Red}; ^
function STEP($m){Write-Host ''; Write-Host '  >>> '$m -ForegroundColor Cyan}; ^
STEP 'Step 1/5: Checking Git...'; ^
$git=Get-Command git -ErrorAction SilentlyContinue; ^
if(-not $git){ ^
  W 'Git not found. Downloading Git for Windows...'; ^
  $tmp=Join-Path $env:TEMP 'git-setup.exe'; ^
  try{ Invoke-WebRequest -Uri $GIT_URL -OutFile $tmp -UseBasicParsing; ^
  W 'Installing Git silently...'; ^
  Start-Process $tmp -ArgumentList '/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /COMPONENTS=icons,ext\reg\shellhere,assoc,assoc_sh' -Wait; ^
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue; ^
  $env:Path=[System.Environment]::GetEnvironmentVariable('Path','Machine')+';'+[System.Environment]::GetEnvironmentVariable('Path','User'); ^
  $git=Get-Command git -ErrorAction SilentlyContinue; ^
  if($git){OK 'Git installed!'}else{ERR 'Git install failed. Install from https://git-scm.com and re-run.'; Read-Host 'Press Enter'; exit 1} ^
  }catch{ERR 'Git download failed. Check internet connection.'; Read-Host 'Press Enter'; exit 1} ^
}else{OK ('Git: '+(& git --version))}; ^
STEP 'Step 2/5: Checking Node.js...'; ^
$node=Get-Command node -ErrorAction SilentlyContinue; ^
if(-not $node){ ^
  W 'Node.js not found. Downloading Node.js v20 LTS...'; ^
  $tmp=Join-Path $env:TEMP 'node-setup.msi'; ^
  try{ Invoke-WebRequest -Uri $NODE_URL -OutFile $tmp -UseBasicParsing; ^
  W 'Installing Node.js silently...'; ^
  Start-Process msiexec.exe -ArgumentList ('/i \"'+$tmp+'\" /quiet /norestart') -Wait; ^
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue; ^
  $env:Path=[System.Environment]::GetEnvironmentVariable('Path','Machine')+';'+[System.Environment]::GetEnvironmentVariable('Path','User'); ^
  $node=Get-Command node -ErrorAction SilentlyContinue; ^
  if($node){OK ('Node.js installed: '+(& node --version))}else{ERR 'Node.js install failed. Install from https://nodejs.org and re-run.'; Read-Host 'Press Enter'; exit 1} ^
  }catch{ERR 'Node.js download failed.'; Read-Host 'Press Enter'; exit 1} ^
}else{OK ('Node.js: '+(& node --version))}; ^
STEP 'Step 3/5: Downloading JARVIS...'; ^
if(Test-Path (Join-Path $INSTALL_DIR '.git')){ ^
  W 'JARVIS already installed. Updating...'; ^
  Set-Location $INSTALL_DIR; ^
  & git pull origin main --ff-only 2>&1 | Out-Null; ^
  OK 'JARVIS updated!' ^
}else{ ^
  if(Test-Path $INSTALL_DIR){Remove-Item $INSTALL_DIR -Recurse -Force}; ^
  W ('Cloning to: '+$INSTALL_DIR); ^
  $r=& git clone $REPO $INSTALL_DIR 2>&1; ^
  if($LASTEXITCODE -ne 0){ERR 'Clone failed. Check internet.'; Read-Host 'Press Enter'; exit 1}; ^
  OK 'JARVIS downloaded!'; ^
  Set-Location $INSTALL_DIR ^
}; ^
STEP 'Step 4/5: Installing dependencies...'; ^
Set-Location $INSTALL_DIR; ^
W 'Running npm install (this takes 1-2 minutes on first run)...'; ^
$r=& npm install --no-fund --no-audit 2>&1; ^
if($LASTEXITCODE -ne 0){ERR 'npm install failed.'; Write-Host $r; Read-Host 'Press Enter'; exit 1}; ^
OK 'Dependencies installed!'; ^
STEP 'Step 5/5: Creating shortcuts...'; ^
$vbs=Join-Path $INSTALL_DIR 'JARVIS.vbs'; ^
$vbsContent='Set WS=CreateObject(""WScript.Shell"")'+[char]10+'WS.CurrentDirectory=""'+$INSTALL_DIR+'""'+[char]10+'WS.Run ""cmd /c npm start"",0,False'; ^
Set-Content -Path $vbs -Value $vbsContent -Encoding UTF8; ^
$desk=[Environment]::GetFolderPath('Desktop'); ^
$ws=New-Object -ComObject WScript.Shell; ^
$sc=$ws.CreateShortcut((Join-Path $desk 'JARVIS.lnk')); ^
$sc.TargetPath='wscript.exe'; ^
$sc.Arguments=('\"'+$vbs+'\"'); ^
$sc.WorkingDirectory=$INSTALL_DIR; ^
$sc.Description='JARVIS AI Assistant'; ^
$ico=Join-Path $INSTALL_DIR 'assets\icons\jarvis.ico'; ^
if(Test-Path $ico){$sc.IconLocation=$ico}; ^
$sc.Save(); ^
$sm=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'; ^
$sc2=$ws.CreateShortcut((Join-Path $sm 'JARVIS.lnk')); ^
$sc2.TargetPath='wscript.exe'; ^
$sc2.Arguments=('\"'+$vbs+'\"'); ^
$sc2.WorkingDirectory=$INSTALL_DIR; ^
$sc2.Description='JARVIS AI Assistant'; ^
if(Test-Path $ico){$sc2.IconLocation=$ico}; ^
$sc2.Save(); ^
OK 'Desktop shortcut created!'; ^
OK 'Start Menu entry created!'; ^
Write-Host ''; ^
Write-Host '  ============================================================' -ForegroundColor Green; ^
Write-Host '   JARVIS INSTALLATION COMPLETE!' -ForegroundColor Green; ^
Write-Host '  ============================================================' -ForegroundColor Green; ^
Write-Host ''; ^
Write-Host '   Installed to: ' -NoNewline -ForegroundColor White; ^
Write-Host $INSTALL_DIR -ForegroundColor Cyan; ^
Write-Host ''; ^
Write-Host '   Launch JARVIS anytime:' -ForegroundColor White; ^
Write-Host '   - Double-click JARVIS on your Desktop' -ForegroundColor Cyan; ^
Write-Host '   - Search JARVIS in the Start Menu' -ForegroundColor Cyan; ^
Write-Host '   - Hotkey: Alt+J (once running)' -ForegroundColor Cyan; ^
Write-Host ''; ^
Write-Host '   TIP: Add your OpenAI API key in Settings for full AI!' -ForegroundColor Yellow; ^
Write-Host '   NOTE: JARVIS auto-updates from GitHub every time it starts.' -ForegroundColor DarkCyan; ^
Write-Host ''; ^
$ans=Read-Host '  Launch JARVIS now? (Y/N)'; ^
if($ans -match '^[Yy]'){ ^
  Write-Host '  Launching JARVIS...' -ForegroundColor Cyan; ^
  Start-Process 'wscript.exe' -ArgumentList ('\"'+$vbs+'\"'); ^
  Write-Host '  JARVIS is starting! Check your taskbar.' -ForegroundColor Green ^
}; ^
Write-Host ''; ^
Write-Host '  Press any key to close...' -ForegroundColor DarkGray; ^
$null=$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') ^
}"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo   PowerShell failed. Trying fallback method...
  echo.
  echo   Please make sure you have internet access and try again.
  echo   If the problem persists, install Node.js from https://nodejs.org
  echo   then run: git clone https://github.com/mercy1234544/jarvis-ai.git
  echo.
  pause
)
