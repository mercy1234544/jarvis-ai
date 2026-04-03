'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');
const https = require('https');

// ── Paths ────────────────────────────────────────────────────
const USER_DATA = app.getPath('userData');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');
const LOG_FILE = path.join(USER_DATA, 'jarvis.log');
const COMMIT_FILE = path.join(USER_DATA, 'last-commit.txt');
const APP_DIR = path.join(__dirname, '..', '..');

// ── Logging ──────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch(e) {}
  console.log(msg);
}

// ── Config ───────────────────────────────────────────────────
let cfg = { apiKey:'', model:'gpt-4o-mini', ttsEnabled:true, startWithWindows:false, autoUpdate:true };
function loadCfg() {
  try { if (fs.existsSync(CONFIG_FILE)) cfg = {...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'))}; } catch(e){}
}
function saveCfg() {
  try { fs.mkdirSync(USER_DATA,{recursive:true}); fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg,null,2)); } catch(e){}
}

// ── Windows ──────────────────────────────────────────────────
let splash=null, win=null, tray=null, quitting=false;

function createSplash() {
  splash = new BrowserWindow({
    width:520, height:420, frame:false, transparent:true,
    alwaysOnTop:true, resizable:false, skipTaskbar:true, center:true,
    webPreferences:{ nodeIntegration:false, contextIsolation:true, preload:path.join(__dirname,'../preload/preload.js') },
    show:false
  });
  splash.loadFile(path.join(__dirname,'../renderer/splash.html'));
  splash.once('ready-to-show', ()=>splash.show());
  splash.on('closed', ()=>splash=null);
}

function createWin() {
  win = new BrowserWindow({
    width:1100, height:700, minWidth:800, minHeight:560,
    frame:false, backgroundColor:'#000810',
    icon:path.join(__dirname,'../../assets/icons/jarvis.ico'),
    webPreferences:{ nodeIntegration:false, contextIsolation:true, preload:path.join(__dirname,'../preload/preload.js') },
    show:false
  });
  win.loadFile(path.join(__dirname,'../renderer/index.html'));
  win.on('close', e=>{ if(!quitting){ e.preventDefault(); win.hide(); } });
  win.on('closed', ()=>win=null);
  win.webContents.setWindowOpenHandler(({url})=>{ shell.openExternal(url); return {action:'deny'}; });
  // Auto-recovery
  win.webContents.on('render-process-gone', (_,details)=>{
    if(details.reason!=='clean-exit') setTimeout(()=>{ if(!win||win.isDestroyed()){ createWin(); win.show(); } },1000);
  });
}

function showWin() {
  if(!win||win.isDestroyed()) createWin();
  if(win.isMinimized()) win.restore();
  win.show(); win.focus();
}

// ── Tray ─────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname,'../../assets/icons/tray.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('JARVIS');
  tray.on('click', ()=>win&&win.isVisible()?win.hide():showWin());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label:'◈ JARVIS', enabled:false },
    { type:'separator' },
    { label:'Open JARVIS', click:()=>showWin() },
    { label:'Check for Updates', click:()=>{ showWin(); runUpdate(true); } },
    { label:'View Logs', click:()=>shell.openPath(LOG_FILE) },
    { type:'separator' },
    { label:'Quit', click:()=>{ quitting=true; app.quit(); } }
  ]));
}

// ── Auto-Updater ─────────────────────────────────────────────
function sendStatus(msg) {
  log('[UPDATE] '+msg);
  if(splash&&!splash.isDestroyed()) splash.webContents.send('status', msg);
  if(win&&!win.isDestroyed()) win.webContents.send('update-status', msg);
}

function getLocalCommit() {
  try { return require('child_process').execSync('git rev-parse HEAD',{cwd:APP_DIR,encoding:'utf8',timeout:5000}).trim(); } catch(e){ return null; }
}

function getRemoteCommit() {
  return new Promise(resolve=>{
    const req = https.request({
      hostname:'api.github.com', path:'/repos/mercy1234544/jarvis-ai/commits/main',
      headers:{'User-Agent':'JARVIS/1.0','Accept':'application/vnd.github.v3+json'}, timeout:8000
    }, res=>{
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{ resolve(JSON.parse(d).sha||null); }catch(e){ resolve(null); } });
    });
    req.on('error',()=>resolve(null));
    req.on('timeout',()=>{ req.destroy(); resolve(null); });
    req.end();
  });
}

function gitPull() {
  return new Promise(resolve=>{
    exec('git pull origin main --ff-only',{cwd:APP_DIR,timeout:30000,encoding:'utf8'},(err,out)=>{
      resolve({ok:!err, out:(out||'').trim()});
    });
  });
}

function npmInstall() {
  return new Promise(resolve=>{
    exec('npm install --no-fund --no-audit',{cwd:APP_DIR,timeout:120000,encoding:'utf8'},(err)=>resolve(!err));
  });
}

function pkgChanged(before,after) {
  try { return require('child_process').execSync(`git diff ${before} ${after} -- package.json`,{cwd:APP_DIR,encoding:'utf8',timeout:5000}).trim().length>0; } catch(e){ return false; }
}

async function runUpdate(manual=false) {
  // Check if git is available
  try { require('child_process').execSync('git --version',{timeout:3000,stdio:'pipe'}); } catch(e){ sendStatus('Git not found — skipping update'); return; }
  if(!fs.existsSync(path.join(APP_DIR,'.git'))){ sendStatus('Not a git repo — skipping update'); return; }

  sendStatus('Checking for updates...');
  const local = getLocalCommit();
  if(!local){ sendStatus('Could not read version — skipping'); return; }

  const remote = await getRemoteCommit();
  if(!remote){ sendStatus(manual?'Could not reach GitHub':'JARVIS is ready'); return; }

  if(local===remote){ sendStatus('JARVIS is up to date'); try{fs.writeFileSync(COMMIT_FILE,local);}catch(e){} return; }

  sendStatus('Update found! Downloading...');
  const pull = await gitPull();
  if(!pull.ok){ sendStatus('Update failed — using current version'); return; }

  sendStatus('Applying update...');
  if(pkgChanged(local,remote)){
    sendStatus('Installing new packages...');
    await npmInstall();
  }
  try{fs.writeFileSync(COMMIT_FILE,remote);}catch(e){}
  sendStatus('Update complete! Restarting...');
  await new Promise(r=>setTimeout(r,1500));
  app.relaunch(); app.exit(0);
}

// ── Boot Sequence ─────────────────────────────────────────────
async function boot() {
  log('JARVIS starting...');
  loadCfg();

  createTray();
  globalShortcut.register('Alt+J', ()=>win&&win.isVisible()?win.hide():showWin());
  globalShortcut.register('Alt+V', ()=>{ showWin(); setTimeout(()=>win&&win.webContents.send('trigger-voice'),300); });

  createSplash();
  await sleep(600);

  // Auto-update
  if(cfg.autoUpdate!==false) await runUpdate();
  else sendStatus('Auto-update disabled');
  await sleep(400);

  const steps = [
    'Loading core modules...', 'Initializing voice system...',
    'Connecting AI core...', 'Loading memory system...',
    'Calibrating neural pathways...', 'Finalizing interface...'
  ];
  for(const s of steps){ sendStatus(s); await sleep(500+Math.random()*300); }

  createWin();
  await new Promise(r=>{ win.once('ready-to-show',r); setTimeout(r,3000); });
  await sleep(300);

  if(splash&&!splash.isDestroyed()) splash.close();
  showWin();

  // System monitor — use wmic on Windows for real CPU, loadavg on Linux/Mac
  let lastCpu = 0;
  function getCpuUsage(cb) {
    if (process.platform === 'win32') {
      exec('wmic cpu get loadpercentage /value', { timeout: 3000 }, (err, out) => {
        if (err) return cb(lastCpu);
        const m = out.match(/LoadPercentage=(\d+)/);
        lastCpu = m ? parseInt(m[1]) : lastCpu;
        cb(lastCpu);
      });
    } else {
      const load = os.loadavg()[0];
      const cores = os.cpus().length;
      lastCpu = Math.min(100, Math.round((load / cores) * 100));
      cb(lastCpu);
    }
  }
  setInterval(()=>{
    if(!win||win.isDestroyed()||!win.isVisible()) return;
    const t=os.totalmem(), f=os.freemem();
    const ram = Math.round(((t-f)/t)*100);
    const uptime = Math.floor(os.uptime()/60);
    getCpuUsage(cpu => {
      win.webContents.send('stats', { cpu, ram, uptime });
    });
  },3000);

  log('JARVIS ready');
}

// ── IPC ───────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.on('win-min', ()=>win&&win.minimize());
  ipcMain.on('win-max', ()=>win&&(win.isMaximized()?win.unmaximize():win.maximize()));
  ipcMain.on('win-hide', ()=>win&&win.hide());
  ipcMain.on('quit', ()=>{ quitting=true; app.quit(); });
  ipcMain.handle('get-cfg', ()=>cfg);
  ipcMain.on('save-cfg', (_,c)=>{
    const prev=cfg.startWithWindows;
    cfg={...cfg,...c}; saveCfg();
    if(c.startWithWindows!==undefined&&c.startWithWindows!==prev)
      app.setLoginItemSettings({openAtLogin:c.startWithWindows,name:'JARVIS',path:process.execPath});
  });
  ipcMain.handle('run-cmd', async(_,cmd)=>await sysCmd(cmd));
  ipcMain.on('open-url', (_,url)=>shell.openExternal(url));
  ipcMain.on('check-update', ()=>runUpdate(true));
  ipcMain.handle('app-info', async()=>({
    version:app.getVersion(), platform:process.platform,
    commit:getLocalCommit()||'unknown', userData:USER_DATA
  }));
}

// ── System Commands ───────────────────────────────────────────
async function sysCmd(cmd) {
  return new Promise(resolve=>{
    const lc=cmd.toLowerCase(), p=process.platform;
    let c='';
    if(lc.includes('screenshot')){
      const f=path.join(os.homedir(),'Desktop',`jarvis-${Date.now()}.png`);
      c=p==='win32'?`powershell -command "Add-Type -AssemblyName System.Windows.Forms; $b=New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width,[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $g=[System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0,0,0,0,$b.Size); $b.Save('${f}')"`:p==='darwin'?`screencapture "${f}"`:`scrot "${f}"`;
    } else if(lc.includes('volume up')||lc.includes('louder')) c=p==='win32'?`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"`:p==='darwin'?`osascript -e 'set volume output volume ((output volume of (get volume settings)) + 10)'`:`amixer -D pulse sset Master 10%+`;
    else if(lc.includes('volume down')||lc.includes('quieter')) c=p==='win32'?`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"`:p==='darwin'?`osascript -e 'set volume output volume ((output volume of (get volume settings)) - 10)'`:`amixer -D pulse sset Master 10%-`;
    else if(lc.includes('mute')) c=p==='win32'?`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`:p==='darwin'?`osascript -e 'set volume output muted true'`:`amixer -D pulse sset Master toggle`;
    else if(lc.includes('open browser')||lc.includes('open chrome')||lc.includes('open edge')) c=p==='win32'?'start msedge':p==='darwin'?'open -a "Google Chrome"':'xdg-open https://google.com';
    else if(lc.includes('open notepad')) c=p==='win32'?'notepad':p==='darwin'?'open -a TextEdit':'gedit';
    else if(lc.includes('open calculator')||lc.includes('open calc')) c=p==='win32'?'calc':p==='darwin'?'open -a Calculator':'gnome-calculator';
    else if(lc.includes('task manager')) c=p==='win32'?'taskmgr':p==='darwin'?'open -a "Activity Monitor"':'gnome-system-monitor';
    else if(lc.includes('open explorer')||lc.includes('file manager')) c=p==='win32'?'explorer':p==='darwin'?'open .':'nautilus';
    else if(lc.includes('open settings')) c=p==='win32'?'start ms-settings:':'open -a "System Preferences"';
    else if(lc.includes('open paint')) c='mspaint';
    else if(lc.includes('open spotify')) c=p==='win32'?'start spotify':'open -a Spotify';
    else if(lc.includes('open discord')) c=p==='win32'?'start discord':'open -a Discord';
    else if(lc.includes('open steam')) c='start steam';
    else if(lc.includes('open vs code')||lc.includes('open vscode')) c='code';
    else if(lc.includes('lock screen')||lc.includes('lock computer')) c=p==='win32'?'rundll32.exe user32.dll,LockWorkStation':'pmset displaysleepnow';
    else if(lc.includes('show desktop')||lc.includes('minimize all')) c=p==='win32'?`powershell -c "(New-Object -ComObject Shell.Application).MinimizeAll()"`:'' ;
    else if(lc.includes('empty recycle bin')) c=`powershell -c "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"`;
    else if(lc.includes('open notepad')) c='notepad';
    else if(lc.startsWith('search for ')||lc.startsWith('google ')) {
      const q=cmd.replace(/^(search for|google)\s+/i,'').trim();
      shell.openExternal('https://www.google.com/search?q='+encodeURIComponent(q));
      return resolve({ok:true,msg:'Searching: '+q});
    } else if(lc.startsWith('play ')&&lc.includes('youtube')) {
      const q=cmd.replace(/^play\s+/i,'').replace(/on youtube/i,'').trim();
      shell.openExternal('https://www.youtube.com/results?search_query='+encodeURIComponent(q));
      return resolve({ok:true,msg:'YouTube: '+q});
    }
    if(!c) return resolve({ok:false,passToAI:true});
    exec(c, err=>resolve({ok:!err,msg:err?'Failed':'Done'}));
  });
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// ── App Lifecycle ─────────────────────────────────────────────
const lock = app.requestSingleInstanceLock();
if(!lock){ app.quit(); }
else {
  app.on('second-instance', ()=>showWin());
  app.whenReady().then(()=>{ setupIPC(); boot(); });
  app.on('window-all-closed', ()=>{ if(process.platform!=='darwin'&&quitting) app.quit(); });
  app.on('before-quit', ()=>{ quitting=true; globalShortcut.unregisterAll(); saveCfg(); });
  process.on('uncaughtException', e=>log('ERROR: '+e.message));
}
