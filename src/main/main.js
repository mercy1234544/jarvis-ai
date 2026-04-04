'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, shell, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { exec } = require('child_process');

const USER_DATA = app.getPath('userData');
const CFG_FILE  = path.join(USER_DATA, 'config.json');
const LOG_FILE  = path.join(USER_DATA, 'jarvis.log');
const APP_DIR   = path.join(__dirname, '..', '..');

// ── Logging ──────────────────────────────────────────────────
function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try { fs.appendFileSync(LOG_FILE, line); } catch(e) {}
  console.log(msg);
}

// ── Config ───────────────────────────────────────────────────
let cfg = { apiKey:'', model:'gpt-4o-mini', ttsEnabled:true, startWithWindows:false, autoUpdate:true };
function loadCfg() {
  try { if (fs.existsSync(CFG_FILE)) cfg = Object.assign({}, cfg, JSON.parse(fs.readFileSync(CFG_FILE,'utf8'))); } catch(e){}
}
function saveCfg() {
  try { fs.mkdirSync(USER_DATA,{recursive:true}); fs.writeFileSync(CFG_FILE, JSON.stringify(cfg,null,2)); } catch(e){}
}

// ── Windows ──────────────────────────────────────────────────
let splash=null, win=null, tray=null, quitting=false;

function createSplash() {
  splash = new BrowserWindow({
    width:520, height:420, frame:false, transparent:true,
    alwaysOnTop:true, resizable:false, skipTaskbar:true, center:true,
    webPreferences:{ nodeIntegration:false, contextIsolation:true,
      preload: path.join(__dirname,'../preload/preload.js') },
    show:false
  });
  splash.loadFile(path.join(__dirname,'../renderer/splash.html'));
  splash.once('ready-to-show', () => splash.show());
  splash.on('closed', () => { splash = null; });
}

function createWin() {
  win = new BrowserWindow({
    width:1100, height:700, minWidth:800, minHeight:560,
    frame:false, backgroundColor:'#000810',
    webPreferences:{ nodeIntegration:false, contextIsolation:true,
      preload: path.join(__dirname,'../preload/preload.js') },
    show:false
  });
  win.loadFile(path.join(__dirname,'../renderer/index.html'));
  win.on('close', e => { if(!quitting){ e.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; });
  win.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action:'deny'}; });
  win.webContents.on('render-process-gone', (_, details) => {
    if(details.reason !== 'clean-exit') {
      log('Renderer crashed, restarting...');
      setTimeout(() => { if(!win || win.isDestroyed()) { createWin(); win.show(); } }, 1500);
    }
  });
  // Grant microphone permission automatically — required for Web Speech API
  win.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'notifications'];
    callback(allowed.includes(permission));
  });
  win.webContents.session.setPermissionCheckHandler((wc, permission) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'notifications'];
    return allowed.includes(permission);
  });
}

function showWin() {
  if(!win || win.isDestroyed()) createWin();
  if(win.isMinimized()) win.restore();
  win.show(); win.focus();
}

// ── Tray ─────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname,'../../assets/icons/tray.png');
  let icon;
  try { icon = nativeImage.createFromPath(iconPath); } catch(e) { icon = nativeImage.createEmpty(); }
  tray = new Tray(icon);
  tray.setToolTip('JARVIS');
  tray.on('click', () => { if(win && win.isVisible()) win.hide(); else showWin(); });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label:'JARVIS', enabled:false },
    { type:'separator' },
    { label:'Open JARVIS',       click:()=>showWin() },
    { label:'Check for Updates', click:()=>{ showWin(); runUpdate(true); } },
    { label:'View Logs',         click:()=>shell.openPath(LOG_FILE) },
    { type:'separator' },
    { label:'Quit', click:()=>{ quitting=true; app.quit(); } }
  ]));
}

// ── Auto-Updater ─────────────────────────────────────────────
function sendStatus(msg) {
  log('[UPDATE] ' + msg);
  if(splash && !splash.isDestroyed()) splash.webContents.send('status', msg);
  if(win    && !win.isDestroyed())    win.webContents.send('update-status', msg);
}

function runUpdate(manual) {
  if(!cfg.autoUpdate && !manual) return;
  sendStatus('Checking for updates...');
  exec('git fetch origin main', { cwd:APP_DIR, timeout:10000 }, (err) => {
    if(err) { if(manual) sendStatus('Could not reach GitHub. Check internet.'); return; }
    exec('git rev-parse HEAD', { cwd:APP_DIR, encoding:'utf8' }, (e1, local) => {
      exec('git rev-parse origin/main', { cwd:APP_DIR, encoding:'utf8' }, (e2, remote) => {
        if(e1||e2) { if(manual) sendStatus('Update check failed.'); return; }
        if(local.trim() === remote.trim()) {
          if(manual) sendStatus('JARVIS is already up to date.');
          return;
        }
        sendStatus('Update found! Downloading...');
        exec('git pull origin main', { cwd:APP_DIR, timeout:30000 }, (err2) => {
          if(err2) { sendStatus('Update download failed.'); return; }
          exec('npm install --no-fund --no-audit', { cwd:APP_DIR, timeout:120000 }, () => {
            sendStatus('Update complete! Restarting JARVIS...');
            setTimeout(() => { app.relaunch(); app.exit(0); }, 2500);
          });
        });
      });
    });
  });
}

// ── System Stats ─────────────────────────────────────────────
let lastCpu = 0;
function sendStats() {
  if(!win || win.isDestroyed() || !win.isVisible()) return;
  const total  = os.totalmem();
  const free   = os.freemem();
  const ram    = Math.round(((total - free) / total) * 100);
  const uptime = Math.floor(os.uptime() / 60);
  if(process.platform === 'win32') {
    exec('wmic cpu get loadpercentage /value', { timeout:3000 }, (err, out) => {
      if(!err) { const m = out.match(/LoadPercentage=(\d+)/); if(m) lastCpu = parseInt(m[1]); }
      if(win && !win.isDestroyed()) win.webContents.send('stats', { cpu:lastCpu, ram, uptime });
    });
  } else {
    const load  = os.loadavg()[0];
    const cores = os.cpus().length;
    lastCpu = Math.min(100, Math.round((load / cores) * 100));
    win.webContents.send('stats', { cpu:lastCpu, ram, uptime });
  }
}

// ── System Commands ───────────────────────────────────────────
function sysCmd(cmd) {
  return new Promise(resolve => {
    const lc = cmd.toLowerCase().trim();
    const p  = process.platform;

    if(lc.startsWith('search for ') || lc.startsWith('google ')) {
      const q = cmd.replace(/^(search for|google)\s+/i,'').trim();
      shell.openExternal('https://www.google.com/search?q=' + encodeURIComponent(q));
      return resolve({ok:true});
    }
    if((lc.startsWith('play ') && lc.includes('youtube')) || lc.startsWith('youtube ')) {
      const q = cmd.replace(/^(play\s+|youtube\s+)/i,'').replace(/on youtube/i,'').trim();
      shell.openExternal('https://www.youtube.com/results?search_query=' + encodeURIComponent(q));
      return resolve({ok:true});
    }

    let c = '';
    if(lc.includes('screenshot')) {
      const f = path.join(os.homedir(),'Desktop','jarvis-' + Date.now() + '.png');
      if(p==='win32') c = 'powershell -command "Add-Type -AssemblyName System.Windows.Forms; $b=New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width,[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $g=[System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0,0,0,0,$b.Size); $b.Save(\'' + f + '\')"';
      else c = p==='darwin' ? 'screencapture "' + f + '"' : 'scrot "' + f + '"';
    }
    else if(lc.includes('volume up')   || lc.includes('louder'))  c = p==='win32' ? 'powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"' : "osascript -e 'set volume output volume ((output volume of (get volume settings)) + 10)'";
    else if(lc.includes('volume down') || lc.includes('quieter')) c = p==='win32' ? 'powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"' : "osascript -e 'set volume output volume ((output volume of (get volume settings)) - 10)'";
    else if(lc.includes('mute'))        c = p==='win32' ? 'powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"' : "osascript -e 'set volume output muted true'";
    else if(lc.includes('open browser') || lc.includes('open chrome') || lc.includes('open edge')) c = p==='win32' ? 'start msedge' : 'open -a "Google Chrome"';
    else if(lc.includes('open notepad') || lc==='notepad') c = p==='win32' ? 'notepad' : 'open -a TextEdit';
    else if(lc.includes('open calculator') || lc.includes('open calc') || lc==='calc') c = p==='win32' ? 'calc' : 'open -a Calculator';
    else if(lc.includes('task manager')) c = p==='win32' ? 'taskmgr' : 'open -a "Activity Monitor"';
    else if(lc.includes('file manager') || lc.includes('file explorer') || lc.includes('open explorer')) c = p==='win32' ? 'explorer' : 'open .';
    else if(lc.includes('open settings') || lc.includes('windows settings')) c = p==='win32' ? 'start ms-settings:' : "open -a 'System Preferences'";
    else if(lc.includes('open paint'))    c = 'mspaint';
    else if(lc.includes('open spotify'))  c = p==='win32' ? 'start spotify' : 'open -a Spotify';
    else if(lc.includes('open discord'))  c = p==='win32' ? 'start discord' : 'open -a Discord';
    else if(lc.includes('open steam'))    c = p==='win32' ? 'start steam' : 'open -a Steam';
    else if(lc.includes('open vs code') || lc.includes('open vscode') || lc==='vscode') c = 'code';
    else if(lc.includes('open cmd') || lc.includes('command prompt')) c = p==='win32' ? 'start cmd' : 'open -a Terminal';
    else if(lc.includes('open powershell')) c = p==='win32' ? 'start powershell' : 'open -a Terminal';
    else if(lc.includes('lock screen') || lc.includes('lock computer') || lc.includes('lock pc')) c = p==='win32' ? 'rundll32.exe user32.dll,LockWorkStation' : 'pmset displaysleepnow';
    else if(lc.includes('show desktop') || lc.includes('minimize all')) c = p==='win32' ? 'powershell -c "(New-Object -ComObject Shell.Application).MinimizeAll()"' : '';
    else if(lc.includes('empty recycle bin')) c = 'powershell -c "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"';

    if(!c) return resolve({ok:false, passToAI:true});
    exec(c, (err) => resolve({ok:!err}));
  });
}

// ── IPC Handlers ─────────────────────────────────────────────
function setupIPC() {
  ipcMain.on('win-min',  () => win && win.minimize());
  ipcMain.on('win-hide', () => win && win.hide());
  ipcMain.on('quit',     () => { quitting=true; app.quit(); });
  ipcMain.handle('get-cfg', () => cfg);
  ipcMain.on('save-cfg', (_, c) => {
    const prev = cfg.startWithWindows;
    cfg = Object.assign({}, cfg, c);
    saveCfg();
    if(c.startWithWindows !== undefined && c.startWithWindows !== prev)
      app.setLoginItemSettings({ openAtLogin: c.startWithWindows, name:'JARVIS', path:process.execPath });
  });
  ipcMain.handle('run-cmd', async (_, cmd) => await sysCmd(cmd));
  ipcMain.on('open-url',     (_, url) => shell.openExternal(url));
  ipcMain.on('check-update', () => runUpdate(true));
}

// ── Boot ─────────────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function boot() {
  loadCfg();
  createSplash();
  createWin();
  createTray();
  setupIPC();

  try {
    globalShortcut.register('Alt+J', () => { if(win && win.isVisible()) win.hide(); else showWin(); });
    globalShortcut.register('Alt+V', () => { showWin(); if(win) win.webContents.send('trigger-voice'); });
  } catch(e) { log('Hotkey error: ' + e.message); }

  const steps = [
    'Initializing voice system...',
    'Connecting AI core...',
    'Loading memory system...',
    'Calibrating interface...',
    'All systems online.'
  ];
  for(const s of steps) { await sleep(600); sendStatus(s); }
  await sleep(500);

  if(splash && !splash.isDestroyed()) splash.close();
  showWin();

  setInterval(sendStats, 3000);
  sendStats();

  if(cfg.autoUpdate) setTimeout(() => runUpdate(false), 6000);
  log('JARVIS boot complete');
}

// ── App Lifecycle ─────────────────────────────────────────────
const lock = app.requestSingleInstanceLock();
if(!lock) {
  app.quit();
} else {
  app.on('second-instance', () => showWin());
  app.whenReady().then(() => boot());
  app.on('window-all-closed', () => { if(process.platform !== 'darwin' && quitting) app.quit(); });
  app.on('before-quit', () => { quitting=true; globalShortcut.unregisterAll(); saveCfg(); });
  process.on('uncaughtException', e => log('UNCAUGHT: ' + e.message));
}
