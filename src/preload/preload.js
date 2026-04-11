'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('JARVIS', {
  minimize:    () => ipcRenderer.send('win-min'),
  hide:        () => ipcRenderer.send('win-hide'),
  getCfg:      () => ipcRenderer.invoke('get-cfg'),
  saveCfg:     (c) => ipcRenderer.send('save-cfg', c),
  runCmd:      (cmd) => ipcRenderer.invoke('run-cmd', cmd),
  openURL:     (url) => ipcRenderer.send('open-url', url),
  checkUpdate: () => ipcRenderer.send('check-update'),
  onStats:        (cb) => ipcRenderer.on('stats',         (_, d) => cb(d)),
  onStatus:       (cb) => ipcRenderer.on('status',        (_, m) => cb(m)),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, m) => cb(m)),
  onVoice:        (cb) => ipcRenderer.on('trigger-voice', ()    => cb()),
  onSettings:     (cb) => ipcRenderer.on('open-settings', ()    => cb()),
  onVoiceTrigger:  (cb) => ipcRenderer.on('trigger-voice', ()    => cb()),
  openWebsite:     (site) => ipcRenderer.invoke('open-website', site),
  getHistory:      () => ipcRenderer.invoke('get-history'),
  saveHistory:     (h) => ipcRenderer.send('save-history', h),
  askAI:           (msg) => ipcRenderer.invoke('ask-ai', msg),
  platform: process.platform
});
