'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('J', {
  // Boot
  onStatus: cb => ipcRenderer.on('status', (_,m) => cb(m)),
  // Window
  minimize: () => ipcRenderer.send('win-min'),
  maximize: () => ipcRenderer.send('win-max'),
  hide:     () => ipcRenderer.send('win-hide'),
  quit:     () => ipcRenderer.send('quit'),
  // Config
  getCfg:   () => ipcRenderer.invoke('get-cfg'),
  saveCfg:  c  => ipcRenderer.send('save-cfg', c),
  // Commands
  runCmd:   cmd => ipcRenderer.invoke('run-cmd', cmd),
  openURL:  url => ipcRenderer.send('open-url', url),
  // Updates
  checkUpdate: () => ipcRenderer.send('check-update'),
  onUpdateStatus: cb => ipcRenderer.on('update-status', (_,m) => cb(m)),
  // Stats
  onStats: cb => ipcRenderer.on('stats', (_,s) => cb(s)),
  // Events
  onVoice:    cb => ipcRenderer.on('trigger-voice', () => cb()),
  onSettings: cb => ipcRenderer.on('open-settings', () => cb()),
  // App info
  appInfo: () => ipcRenderer.invoke('app-info'),
  platform: process.platform
});
