#!/usr/bin/env python3
"""Generate all JARVIS source files"""
import os

BASE = '/home/ubuntu/jarvis'

# ── index.html ──────────────────────────────────────────────────────────────
INDEX_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://api.openai.com; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src https://api.openai.com https://api.github.com">
<title>JARVIS</title>
<style>
:root{--p:#00d4ff;--p2:#0066ff;--bg:#000810;--bg2:#000f1e;--bg3:#001428;--border:rgba(0,180,255,0.12);--text:rgba(0,220,255,0.85);--dim:rgba(0,180,255,0.4);}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:"Courier New",monospace;height:100vh;display:flex;flex-direction:column;overflow:hidden;user-select:none;}
#titlebar{height:36px;background:rgba(0,8,20,0.95);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 12px;-webkit-app-region:drag;flex-shrink:0;}
#titlebar .logo{font-size:11px;letter-spacing:6px;color:var(--p);text-shadow:0 0 10px rgba(0,212,255,0.5);font-weight:bold;}
#titlebar .spacer{flex:1;}
.tb-btn{width:28px;height:28px;border:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer;border-radius:4px;font-size:12px;display:flex;align-items:center;justify-content:center;-webkit-app-region:no-drag;transition:all 0.2s;}
.tb-btn:hover{border-color:var(--p);color:var(--p);background:rgba(0,212,255,0.05);}
#btnClose:hover{border-color:#ff4444;color:#ff4444;background:rgba(255,68,68,0.1);}
.tb-gap{width:4px;}
#statusBar{height:28px;background:rgba(0,10,24,0.8);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 14px;gap:10px;flex-shrink:0;}
.pill{font-size:8px;letter-spacing:2px;padding:3px 8px;border:1px solid rgba(0,180,255,0.2);border-radius:10px;color:rgba(0,180,255,0.4);}
.pill.active{border-color:rgba(0,212,255,0.5);color:rgba(0,212,255,0.8);text-shadow:0 0 8px rgba(0,212,255,0.4);}
.pill-spacer{flex:1;}
#clock{font-size:9px;letter-spacing:2px;color:var(--dim);}
#main{flex:1;display:flex;overflow:hidden;}
#leftPanel{width:200px;border-right:1px solid var(--border);display:flex;flex-direction:column;background:rgba(0,8,20,0.6);flex-shrink:0;}
.panel-title{font-size:8px;letter-spacing:3px;color:var(--dim);padding:10px 12px 6px;border-bottom:1px solid var(--border);}
#arcBox{padding:16px;display:flex;flex-direction:column;align-items:center;border-bottom:1px solid var(--border);}
#arcReactor{position:relative;width:90px;height:90px;display:flex;align-items:center;justify-content:center;}
.ar{position:absolute;border-radius:50%;border:1.5px solid transparent;animation:spin linear infinite;}
.ar1{width:86px;height:86px;border-top-color:rgba(0,212,255,0.7);animation-duration:4s;}
.ar2{width:68px;height:68px;border-bottom-color:rgba(0,170,255,0.6);animation-duration:3s;animation-direction:reverse;}
.ar3{width:50px;height:50px;border-top-color:rgba(100,220,255,0.5);animation-duration:5s;}
.arc-core{width:24px;height:24px;border-radius:50%;background:radial-gradient(circle,#fff 0%,#a0eeff 30%,#00d4ff 70%,#0044aa 100%);box-shadow:0 0 12px #00d4ff,0 0 24px rgba(0,212,255,0.5);animation:corePulse 2s ease-in-out infinite;}
#vsdText{font-size:8px;letter-spacing:2px;color:var(--dim);margin-top:8px;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes corePulse{0%,100%{box-shadow:0 0 12px #00d4ff,0 0 24px rgba(0,212,255,0.5);}50%{box-shadow:0 0 20px #00d4ff,0 0 40px rgba(0,212,255,0.8);}}
#vizBox{padding:8px 12px;border-bottom:1px solid var(--border);}
#viz{display:flex;align-items:flex-end;gap:2px;height:30px;justify-content:center;}
.vb{width:4px;height:4px;background:var(--p);border-radius:2px;transition:height 0.1s;opacity:0.5;}
#viz.active .vb{opacity:1;}
#voiceTranscript{font-size:8px;color:var(--dim);text-align:center;margin-top:4px;letter-spacing:1px;min-height:10px;}
#quickBox{flex:1;overflow-y:auto;padding:8px;}
.qcmd{width:100%;padding:6px 8px;background:rgba(0,180,255,0.03);border:1px solid var(--border);color:var(--dim);font-family:inherit;font-size:8px;letter-spacing:1px;cursor:pointer;border-radius:3px;margin-bottom:4px;text-align:left;transition:all 0.2s;}
.qcmd:hover{background:rgba(0,212,255,0.08);border-color:rgba(0,212,255,0.3);color:var(--p);}
#center{flex:1;display:flex;flex-direction:column;overflow:hidden;}
#chatArea{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}
#chatArea::-webkit-scrollbar{width:3px;}
#chatArea::-webkit-scrollbar-thumb{background:rgba(0,180,255,0.2);border-radius:2px;}
.msg{max-width:85%;animation:fadeIn 0.3s ease;}
.msg.user{align-self:flex-end;}
.msg.jarvis{align-self:flex-start;}
.msg-hdr{font-size:7px;letter-spacing:2px;color:var(--dim);margin-bottom:3px;}
.msg.user .msg-hdr{text-align:right;}
.msg-bubble{padding:8px 12px;border-radius:6px;font-size:11px;line-height:1.6;letter-spacing:0.3px;}
.msg.user .msg-bubble{background:rgba(0,102,255,0.12);border:1px solid rgba(0,102,255,0.25);color:rgba(200,230,255,0.9);border-radius:6px 6px 2px 6px;}
.msg.jarvis .msg-bubble{background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.15);color:rgba(0,220,255,0.9);border-radius:6px 6px 6px 2px;}
.typing{display:flex;gap:4px;padding:10px 12px;align-self:flex-start;}
.dot{width:5px;height:5px;border-radius:50%;background:var(--p);opacity:0.4;animation:blink 1.2s ease-in-out infinite;}
.dot:nth-child(2){animation-delay:0.2s;}.dot:nth-child(3){animation-delay:0.4s;}
@keyframes blink{0%,80%,100%{opacity:0.2;}40%{opacity:1;}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
.welcome{text-align:center;padding:30px 20px;color:var(--dim);}
.welcome .wt{font-size:14px;letter-spacing:4px;color:var(--p);margin-bottom:8px;}
.welcome .ws{font-size:9px;letter-spacing:2px;}
#inputArea{border-top:1px solid var(--border);padding:10px 12px;display:flex;gap:8px;align-items:flex-end;background:rgba(0,8,20,0.8);}
#userInput{flex:1;background:rgba(0,180,255,0.04);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:11px;padding:8px 10px;border-radius:4px;resize:none;min-height:36px;max-height:100px;outline:none;transition:border-color 0.2s;}
#userInput:focus{border-color:rgba(0,212,255,0.4);}
#userInput::placeholder{color:rgba(0,180,255,0.25);}
.inp-btn{width:36px;height:36px;border:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer;border-radius:4px;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;}
.inp-btn:hover{border-color:var(--p);color:var(--p);background:rgba(0,212,255,0.06);}
.inp-btn.recording{border-color:#ff4444;color:#ff4444;animation:recPulse 1s infinite;}
@keyframes recPulse{0%,100%{box-shadow:none;}50%{box-shadow:0 0 8px rgba(255,68,68,0.5);}}
#rightPanel{width:180px;border-left:1px solid var(--border);display:flex;flex-direction:column;background:rgba(0,8,20,0.6);flex-shrink:0;}
#gaugeBox{padding:10px;border-bottom:1px solid var(--border);}
.gauge{margin-bottom:10px;text-align:center;}
.gauge-label{font-size:7px;letter-spacing:2px;color:var(--dim);margin-bottom:4px;}
.gauge-ring{position:relative;width:60px;height:60px;margin:0 auto;}
.gauge-ring svg{transform:rotate(-90deg);}
.gauge-bg{fill:none;stroke:rgba(0,180,255,0.08);stroke-width:4;}
.gauge-arc{fill:none;stroke:#00d4ff;stroke-width:4;stroke-dasharray:172;stroke-dashoffset:172;stroke-linecap:round;transition:stroke-dashoffset 0.5s ease,stroke 0.5s ease;}
.gauge-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;color:var(--p);font-weight:bold;}
#netBox{padding:10px;border-bottom:1px solid var(--border);}
#netBars{display:flex;align-items:flex-end;gap:2px;height:40px;}
.nb{flex:1;background:rgba(0,212,255,0.3);border-radius:1px;transition:height 0.3s;}
#netLabel{font-size:7px;letter-spacing:1px;color:var(--dim);margin-top:4px;text-align:center;}
#actBox{flex:1;overflow-y:auto;padding:8px;}
#actBox::-webkit-scrollbar{width:2px;}
#actBox::-webkit-scrollbar-thumb{background:rgba(0,180,255,0.15);}
.act{font-size:7px;color:rgba(0,180,255,0.4);padding:3px 0;border-bottom:1px solid rgba(0,180,255,0.05);letter-spacing:0.5px;}
.act-t{color:rgba(0,180,255,0.25);margin-right:4px;}
#voiceBar{height:38px;border-top:1px solid var(--border);display:flex;align-items:center;padding:0 12px;gap:10px;background:rgba(0,8,20,0.8);flex-shrink:0;}
#voiceToggle{padding:5px 12px;background:rgba(0,180,255,0.05);border:1px solid var(--border);color:var(--dim);font-family:inherit;font-size:8px;letter-spacing:2px;cursor:pointer;border-radius:3px;transition:all 0.2s;}
#voiceToggle:hover,#voiceToggle.on{background:rgba(0,212,255,0.1);border-color:rgba(0,212,255,0.4);color:var(--p);}
.wake-label{font-size:8px;letter-spacing:1px;color:var(--dim);}
.toggle-sw{position:relative;width:28px;height:14px;cursor:pointer;}
.toggle-sw input{opacity:0;width:0;height:0;}
.sw-slider{position:absolute;inset:0;background:rgba(0,180,255,0.1);border:1px solid var(--border);border-radius:14px;transition:0.3s;}
.sw-slider:before{content:"";position:absolute;height:8px;width:8px;left:2px;bottom:2px;background:var(--dim);border-radius:50%;transition:0.3s;}
input:checked+.sw-slider{background:rgba(0,212,255,0.15);border-color:rgba(0,212,255,0.4);}
input:checked+.sw-slider:before{transform:translateX(14px);background:var(--p);}
#settingsPanel{display:none;position:absolute;top:64px;right:8px;width:280px;background:#000f1e;border:1px solid rgba(0,212,255,0.2);border-radius:6px;z-index:100;padding:14px;box-shadow:0 8px 32px rgba(0,0,0,0.8);}
.sp-title{font-size:9px;letter-spacing:3px;color:var(--p);margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px;}
.sp-row{margin-bottom:10px;}
.sp-label{font-size:8px;letter-spacing:1px;color:var(--dim);margin-bottom:4px;display:block;}
.sp-input{width:100%;background:rgba(0,180,255,0.04);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:10px;padding:6px 8px;border-radius:3px;outline:none;}
.sp-input:focus{border-color:rgba(0,212,255,0.4);}
.sp-select{width:100%;background:#000f1e;border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:10px;padding:6px 8px;border-radius:3px;outline:none;}
.sp-row-h{display:flex;align-items:center;justify-content:space-between;}
.sp-btn{padding:7px 14px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.3);color:var(--p);font-family:inherit;font-size:9px;letter-spacing:2px;cursor:pointer;border-radius:3px;width:100%;margin-top:6px;transition:all 0.2s;}
.sp-btn:hover{background:rgba(0,212,255,0.15);}
.sp-btn.sm{width:auto;padding:5px 10px;font-size:8px;margin-top:0;}
#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(20px);background:rgba(0,20,40,0.95);border:1px solid rgba(0,212,255,0.3);color:var(--p);font-size:9px;letter-spacing:2px;padding:8px 16px;border-radius:4px;opacity:0;transition:all 0.3s;pointer-events:none;z-index:200;white-space:nowrap;}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
</style>
</head>
<body>
<div id="titlebar">
  <span class="logo">J.A.R.V.I.S.</span>
  <span class="spacer"></span>
  <button class="tb-btn" id="btnSettings" title="Settings">&#9881;</button>
  <div class="tb-gap"></div>
  <button class="tb-btn" id="btnMin" title="Minimize">&#8722;</button>
  <div class="tb-gap"></div>
  <button class="tb-btn" id="btnClose" title="Hide to Tray">&#215;</button>
</div>
<div id="statusBar">
  <div class="pill active" id="aiPill">AI CORE ACTIVE</div>
  <div class="pill active" id="voicePill">VOICE READY</div>
  <div class="pill active">SYSTEM ONLINE</div>
  <div class="pill-spacer"></div>
  <div id="clock">00:00:00</div>
</div>
<div id="main">
  <div id="leftPanel">
    <div class="panel-title">ARC REACTOR</div>
    <div id="arcBox">
      <div id="arcReactor">
        <div class="ar ar1"></div><div class="ar ar2"></div><div class="ar ar3"></div>
        <div class="arc-core"></div>
      </div>
      <div id="vsdText">READY</div>
    </div>
    <div id="vizBox">
      <div id="viz">
        <div class="vb" id="vb0"></div><div class="vb" id="vb1"></div><div class="vb" id="vb2"></div>
        <div class="vb" id="vb3"></div><div class="vb" id="vb4"></div><div class="vb" id="vb5"></div>
        <div class="vb" id="vb6"></div><div class="vb" id="vb7"></div><div class="vb" id="vb8"></div>
        <div class="vb" id="vb9"></div><div class="vb" id="vb10"></div><div class="vb" id="vb11"></div>
      </div>
      <div id="voiceTranscript">Listening for commands...</div>
    </div>
    <div class="panel-title">QUICK COMMANDS</div>
    <div id="quickBox">
      <button class="qcmd" data-cmd="screenshot">&#128247; Screenshot</button>
      <button class="qcmd" data-cmd="open browser">&#127760; Open Browser</button>
      <button class="qcmd" data-cmd="open calculator">&#129518; Calculator</button>
      <button class="qcmd" data-cmd="open notepad">&#128221; Notepad</button>
      <button class="qcmd" data-cmd="open task manager">&#128202; Task Manager</button>
      <button class="qcmd" data-cmd="open file manager">&#128193; File Explorer</button>
      <button class="qcmd" data-cmd="volume up">&#128266; Volume Up</button>
      <button class="qcmd" data-cmd="volume down">&#128265; Volume Down</button>
      <button class="qcmd" data-cmd="mute">&#128264; Mute</button>
      <button class="qcmd" data-cmd="lock screen">&#128274; Lock Screen</button>
      <button class="qcmd" data-cmd="show desktop">&#128421; Show Desktop</button>
      <button class="qcmd" data-cmd="open settings">&#9881; Windows Settings</button>
    </div>
  </div>
  <div id="center">
    <div id="chatArea">
      <div class="welcome">
        <div class="wt">JARVIS ONLINE</div>
        <div class="ws">Type a command or click the mic to speak</div>
      </div>
    </div>
    <div id="inputArea">
      <textarea id="userInput" rows="1" placeholder="Command JARVIS... (Enter to send)"></textarea>
      <button class="inp-btn" id="micBtn" title="Voice Input"><span id="micIcon">&#127899;</span></button>
      <button class="inp-btn" id="sendBtn" title="Send">&#10148;</button>
    </div>
  </div>
  <div id="rightPanel">
    <div class="panel-title">SYSTEM STATS</div>
    <div id="gaugeBox">
      <div class="gauge">
        <div class="gauge-label">CPU LOAD</div>
        <div class="gauge-ring">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle class="gauge-bg" cx="30" cy="30" r="27"/>
            <circle class="gauge-arc" id="cpuArc" cx="30" cy="30" r="27"/>
          </svg>
          <div class="gauge-val" id="cpuVal">0%</div>
        </div>
      </div>
      <div class="gauge">
        <div class="gauge-label">RAM USAGE</div>
        <div class="gauge-ring">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle class="gauge-bg" cx="30" cy="30" r="27"/>
            <circle class="gauge-arc" id="ramArc" cx="30" cy="30" r="27" style="stroke:#0066ff;"/>
          </svg>
          <div class="gauge-val" id="ramVal">0%</div>
        </div>
      </div>
    </div>
    <div class="panel-title">NETWORK</div>
    <div id="netBox">
      <div id="netBars">
        <div class="nb"></div><div class="nb"></div><div class="nb"></div><div class="nb"></div>
        <div class="nb"></div><div class="nb"></div><div class="nb"></div><div class="nb"></div>
      </div>
      <div id="netLabel">UPTIME: 0m</div>
    </div>
    <div class="panel-title">ACTIVITY LOG</div>
    <div id="actBox"></div>
  </div>
</div>
<div id="voiceBar">
  <button id="voiceToggle">&#9654; ACTIVATE VOICE</button>
  <span class="wake-label">WAKE WORD</span>
  <label class="toggle-sw"><input type="checkbox" id="wakeToggle"><span class="sw-slider"></span></label>
</div>
<div id="settingsPanel">
  <div class="sp-title">&#9881; JARVIS SETTINGS</div>
  <div class="sp-row">
    <label class="sp-label">OPENAI API KEY</label>
    <input class="sp-input" type="password" id="apiKeyInput" placeholder="sk-...">
  </div>
  <div class="sp-row">
    <label class="sp-label">AI MODEL</label>
    <select class="sp-select" id="modelSelect">
      <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
      <option value="gpt-4o">GPT-4o (Smart)</option>
      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Economy)</option>
    </select>
  </div>
  <div class="sp-row">
    <div class="sp-row-h">
      <span class="sp-label">LAUNCH ON STARTUP</span>
      <label class="toggle-sw"><input type="checkbox" id="startupToggle"><span class="sw-slider"></span></label>
    </div>
  </div>
  <div class="sp-row">
    <div class="sp-row-h">
      <span class="sp-label">VOICE RESPONSES (TTS)</span>
      <label class="toggle-sw"><input type="checkbox" id="ttsToggle" checked><span class="sw-slider"></span></label>
    </div>
  </div>
  <div class="sp-row">
    <div class="sp-row-h">
      <span class="sp-label">AUTO-UPDATE ON LAUNCH</span>
      <label class="toggle-sw"><input type="checkbox" id="autoUpdateToggle" checked><span class="sw-slider"></span></label>
    </div>
  </div>
  <div class="sp-row" style="display:flex;gap:6px;">
    <button class="sp-btn sm" id="checkUpdateBtn">CHECK UPDATES</button>
    <button class="sp-btn sm" id="viewLogsBtn">VIEW LOGS</button>
  </div>
  <button class="sp-btn" id="saveBtn">SAVE SETTINGS</button>
</div>
<div id="toast"></div>
<script src="renderer.js"></script>
</body>
</html>"""

# ── renderer.js ─────────────────────────────────────────────────────────────
RENDERER_JS = r"""'use strict';
const J = window.J;
let cfg = { apiKey:'', model:'gpt-4o-mini', ttsEnabled:true, startWithWindows:false, autoUpdate:true };
let voice = { rec:null, synth:window.speechSynthesis, listening:false, voice:null, continuous:false };
let recording=false, processing=false, history=[];

// DOM refs
const $ = id => document.getElementById(id);
const chatArea=$('chatArea'), userInput=$('userInput'), sendBtn=$('sendBtn');
const micBtn=$('micBtn'), micIcon=$('micIcon'), viz=$('viz');
const voiceToggle=$('voiceToggle'), wakeToggle=$('wakeToggle');
const voiceTranscript=$('voiceTranscript'), vsdText=$('vsdText');
const arcReactor=$('arcReactor'), actBox=$('actBox');
const toast=$('toast'), settingsPanel=$('settingsPanel');
const btnSettings=$('btnSettings'), btnMin=$('btnMin'), btnClose=$('btnClose');
const aiPill=$('aiPill'), voicePill=$('voicePill'), clock=$('clock');

// ── INIT ──────────────────────────────────────────────────────────────────
async function init() {
  if(J) cfg = await J.getCfg();
  applySettings();
  initVoice();
  bindEvents();
  bindIPC();
  tickClock();
  setTimeout(()=>{
    const h=new Date().getHours();
    const g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    addMsg('jarvis', g+', Sir. JARVIS is fully online. All systems nominal. How may I assist you today?');
    if(cfg.ttsEnabled) speak(g+', Sir. JARVIS is fully online.');
  }, 400);
  log('JARVIS initialized');
}

function applySettings() {
  if($('apiKeyInput')) $('apiKeyInput').value = cfg.apiKey||'';
  if($('modelSelect')) $('modelSelect').value = cfg.model||'gpt-4o-mini';
  if($('startupToggle')) $('startupToggle').checked = !!cfg.startWithWindows;
  if($('ttsToggle')) $('ttsToggle').checked = cfg.ttsEnabled!==false;
  if($('autoUpdateToggle')) $('autoUpdateToggle').checked = cfg.autoUpdate!==false;
  updateAIPill();
}

function updateAIPill() {
  if(cfg.apiKey){ aiPill.textContent='AI CORE ACTIVE'; aiPill.classList.add('active'); aiPill.style.cssText=''; }
  else{ aiPill.textContent='NO API KEY'; aiPill.classList.remove('active'); aiPill.style.borderColor='rgba(255,170,0,0.5)'; aiPill.style.color='rgba(255,170,0,0.7)'; }
}

function tickClock() {
  const update=()=>{ clock.textContent=new Date().toLocaleTimeString(); };
  update(); setInterval(update,1000);
}

// ── VOICE ENGINE ──────────────────────────────────────────────────────────
function initVoice() {
  loadVoices();
  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){
    voicePill.textContent='VOICE N/A'; voicePill.style.borderColor='rgba(255,50,50,0.4)'; voicePill.style.color='rgba(255,50,50,0.6)'; return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  voice.rec=new SR(); voice.rec.continuous=false; voice.rec.interimResults=true; voice.rec.lang='en-US';
  voice.rec.onstart=()=>{ voice.listening=true; setState('listening'); };
  voice.rec.onend=()=>{
    voice.listening=false; recording=false;
    micBtn.classList.remove('recording'); micIcon.textContent='\uD83C\uDF99';
    if(!processing) setState('idle');
    if(voice.continuous) setTimeout(()=>{ if(voice.continuous&&!voice.listening) startRec(); },400);
  };
  voice.rec.onresult=e=>{
    let fin='',int='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal) fin+=t; else int+=t;
    }
    if(int) voiceTranscript.textContent=int+'...';
    if(fin){
      voiceTranscript.textContent=fin.trim();
      const lc=fin.trim().toLowerCase();
      if(voice.continuous&&cfg.wakeWordEnabled){
        if(lc.includes('hey jarvis')||lc.includes('jarvis')){
          const cmd=lc.replace(/hey jarvis|jarvis/gi,'').trim();
          if(cmd) process(cmd); else{ speak('Yes, Sir?'); addMsg('jarvis','Yes, Sir?'); }
        }
      } else process(fin.trim());
    }
  };
  voice.rec.onerror=e=>{
    voice.listening=false; recording=false;
    micBtn.classList.remove('recording'); micIcon.textContent='\uD83C\uDF99';
    if(e.error!=='no-speech'&&e.error!=='aborted'){ setState('error'); setTimeout(()=>setState('idle'),2000); }
    else setState('idle');
    if(voice.continuous&&e.error==='no-speech') setTimeout(()=>{ if(voice.continuous&&!voice.listening) startRec(); },500);
  };
  voicePill.textContent='VOICE READY'; voicePill.classList.add('active');
}

function loadVoices() {
  const try_=()=>{
    const vs=window.speechSynthesis.getVoices();
    if(!vs.length) return;
    const pref=['Google UK English Male','Microsoft George','Microsoft David','Daniel','Alex'];
    for(const n of pref){ const v=vs.find(v=>v.name.includes(n)); if(v){ voice.voice=v; return; } }
    voice.voice=vs.find(v=>v.lang.startsWith('en'))||vs[0];
  };
  if(window.speechSynthesis.getVoices().length) try_();
  else window.speechSynthesis.addEventListener('voiceschanged',try_,{once:true});
  setTimeout(try_,1000);
}

function startRec(){ if(!voice.rec||voice.listening) return; try{ voice.rec.start(); }catch(e){} }
function stopRec(){ if(!voice.rec) return; voice.continuous=false; try{ voice.rec.stop(); }catch(e){} }

function speak(text,cb){
  if(!cfg.ttsEnabled||!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean=text.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/`(.*?)`/g,'$1').replace(/#{1,6}\s/g,'').replace(/\n+/g,'. ').substring(0,400);
  const u=new SpeechSynthesisUtterance(clean);
  if(voice.voice) u.voice=voice.voice;
  u.rate=0.95; u.pitch=0.9; u.volume=0.9;
  u.onstart=()=>setState('speaking');
  u.onend=()=>{ setState('idle'); if(cb) cb(); };
  u.onerror=()=>setState('idle');
  window.speechSynthesis.speak(u);
}

// ── STATE ─────────────────────────────────────────────────────────────────
let vizInt=null;
function setState(s){
  const labels={idle:'READY',listening:'LISTENING...',processing:'PROCESSING...',speaking:'SPEAKING...',error:'ERROR',updating:'UPDATING...'};
  vsdText.textContent=labels[s]||'READY';
  arcReactor.className='';
  if(s==='speaking') arcReactor.style.filter='drop-shadow(0 0 8px #00d4ff)';
  else if(s==='processing'||s==='updating') arcReactor.style.filter='drop-shadow(0 0 12px #ffaa00)';
  else arcReactor.style.filter='';
  if(s==='listening'){ viz.classList.add('active'); startViz(); }
  else{ viz.classList.remove('active'); stopViz(); }
}
function startViz(){ stopViz(); vizInt=setInterval(()=>{ for(let i=0;i<12;i++){ const b=document.getElementById('vb'+i); if(b) b.style.height=(Math.random()*26+4)+'px'; } },100); }
function stopViz(){ if(vizInt){ clearInterval(vizInt); vizInt=null; } for(let i=0;i<12;i++){ const b=document.getElementById('vb'+i); if(b) b.style.height='4px'; } }

// ── PROCESS ───────────────────────────────────────────────────────────────
async function process(text){
  if(!text.trim()||processing) return;
  processing=true; setState('processing');
  addMsg('user',text); log('User: '+text.substring(0,40));
  const tid=showTyping();
  try{
    const sys=await handleSysCmd(text);
    if(sys&&sys.handled&&!sys.passToAI){
      removeTyping(tid);
      const r=sys.response||'Done, Sir.';
      addMsg('jarvis',r); if(cfg.ttsEnabled) speak(r); log('JARVIS: '+r.substring(0,40));
    } else {
      const ai=await callAI(text);
      removeTyping(tid);
      const m=ai.clean||ai.msg;
      addMsg('jarvis',m); if(cfg.ttsEnabled) speak(m); log('JARVIS: '+m.substring(0,40));
      if(ai.cmds) for(const c of ai.cmds) await runCmd(c);
    }
  } catch(e){
    removeTyping(tid);
    const em='I encountered a technical difficulty, Sir. '+e.message;
    addMsg('jarvis',em); if(cfg.ttsEnabled) speak('I encountered a technical difficulty, Sir.');
  }
  processing=false; setState('idle'); voiceTranscript.textContent='Listening for commands...';
}

// ── SYSTEM COMMANDS ───────────────────────────────────────────────────────
async function handleSysCmd(text){
  const lc=text.toLowerCase();
  if(lc.match(/^(what.s the )?(time|current time)\??$/)) return{handled:true,response:'The current time is '+new Date().toLocaleTimeString()+', Sir.'};
  if(lc.match(/^(what.s (today.s |the )?(date|day))\??$/)) return{handled:true,response:'Today is '+new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+', Sir.'};
  const map={
    'screenshot':'screenshot','take a screenshot':'screenshot','capture screen':'screenshot',
    'volume up':'volume up','increase volume':'volume up','louder':'volume up',
    'volume down':'volume down','decrease volume':'volume down','quieter':'volume down',
    'mute':'mute','mute volume':'mute','silence':'mute',
    'open browser':'open browser','open chrome':'open browser','open edge':'open browser',
    'open notepad':'open notepad','open text editor':'open notepad',
    'open calculator':'open calculator','open calc':'open calculator',
    'open task manager':'open task manager','open file manager':'open file manager',
    'open explorer':'open file manager','lock screen':'lock screen','lock computer':'lock screen',
    'show desktop':'show desktop','minimize all':'show desktop',
    'empty recycle bin':'empty recycle bin','open settings':'open settings',
    'open paint':'open paint','open spotify':'open spotify','open discord':'open discord',
    'open steam':'open steam','open vs code':'open vs code','open vscode':'open vs code'
  };
  const resp={
    'screenshot':'Screenshot captured and saved to your Desktop, Sir.',
    'volume up':'Volume increased, Sir.','volume down':'Volume decreased, Sir.',
    'mute':'Audio muted, Sir.','open browser':'Opening your web browser, Sir.',
    'open notepad':'Opening Notepad, Sir.','open calculator':'Opening Calculator, Sir.',
    'open task manager':'Opening Task Manager, Sir.','open file manager':'Opening File Explorer, Sir.',
    'lock screen':'Locking the workstation, Sir.','show desktop':'Showing desktop, Sir.',
    'empty recycle bin':'Recycle bin emptied, Sir.','open settings':'Opening Settings, Sir.',
    'open paint':'Opening Paint, Sir.','open spotify':'Opening Spotify, Sir.',
    'open discord':'Opening Discord, Sir.','open steam':'Opening Steam, Sir.',
    'open vs code':'Opening VS Code, Sir.'
  };
  for(const[t,c] of Object.entries(map)){
    if(lc===t||lc.startsWith(t+' ')||lc.endsWith(' '+t)){
      await runCmd(c); return{handled:true,response:resp[c]||c+' done, Sir.'};
    }
  }
  if(lc.startsWith('search for ')||lc.startsWith('google ')||lc.startsWith('search ')){
    const q=text.replace(/^(search for|google|search)\s+/i,'').trim();
    await runCmd('search for '+q); return{handled:true,response:'Searching Google for "'+q+'", Sir.'};
  }
  if(lc.startsWith('play ')&&lc.includes('youtube')){
    const q=text.replace(/^play\s+/i,'').replace(/on youtube/i,'').trim();
    await runCmd('play '+q+' on youtube'); return{handled:true,response:'Opening YouTube for "'+q+'", Sir.'};
  }
  if(lc.startsWith('open ')&&(lc.includes('.com')||lc.includes('.org')||lc.includes('.net'))){
    const site=text.replace(/^open\s+/i,'').trim();
    if(J) J.openURL(site.startsWith('http')?site:'https://'+site);
    return{handled:true,response:'Opening '+site+', Sir.'};
  }
  if(lc.includes('check for update')||lc.includes('update jarvis')||lc==='update'){
    if(J) J.checkUpdate(); return{handled:true,response:'Checking for updates now, Sir.'};
  }
  return{handled:false,passToAI:true};
}

async function runCmd(cmd){
  if(J){ try{ return await J.runCmd(cmd); }catch(e){ return{ok:false}; } }
  return{ok:false};
}

// ── AI ────────────────────────────────────────────────────────────────────
async function callAI(text){
  if(!cfg.apiKey) return fallback(text);
  const msgs=[
    {role:'system',content:'You are JARVIS (Just A Rather Very Intelligent System) from Iron Man. You run as a desktop app on the user\'s Windows PC.\n\nPERSONALITY: Intelligent, witty, slightly formal. Address user as "Sir". Speak like movie JARVIS.\n\nPC CONTROL: When executing system commands, include [EXECUTE: command] in your response.\nCommands: screenshot, volume up, volume down, mute, open browser, open notepad, open calculator, open task manager, open file manager, lock screen, show desktop, empty recycle bin, search for QUERY, play QUERY on youtube\n\nKeep responses concise (2-4 sentences). Be helpful and in-character.'},
    ...history.slice(-10),
    {role:'user',content:text}
  ];
  try{
    const r=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey},
      body:JSON.stringify({model:cfg.model||'gpt-4o-mini',messages:msgs,max_tokens:300,temperature:0.8})
    });
    if(!r.ok){ const e=await r.json(); throw new Error(e.error?.message||'HTTP '+r.status); }
    const d=await r.json(); const m=d.choices[0].message.content;
    history.push({role:'user',content:text},{role:'assistant',content:m});
    if(history.length>20) history=history.slice(-20);
    const cmds=[]; const re=/\[EXECUTE:\s*([^\]]+)\]/gi; let mt;
    while((mt=re.exec(m))!==null) cmds.push(mt[1].trim());
    return{ok:true,msg:m,clean:m.replace(/\[EXECUTE:[^\]]+\]/gi,'').trim(),cmds};
  } catch(e){ return{ok:false,msg:aiErr(e.message),clean:aiErr(e.message),cmds:[]}; }
}

function fallback(text){
  const lc=text.toLowerCase();
  const h=new Date().getHours(), g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  if(lc.match(/^(hi|hello|hey)$/)) return{ok:true,clean:g+', Sir. All systems operational. How may I assist you?',cmds:[]};
  if(lc.includes('how are you')||lc.includes('status')) return{ok:true,clean:'All systems running at optimal efficiency, Sir. Arc reactor output stable.',cmds:[]};
  if(lc.includes('help')||lc.includes('what can you do')) return{ok:true,clean:'I can control your PC, Sir: volume, screenshots, open apps, search the web, and more. Add your OpenAI API key in Settings for full AI conversation.',cmds:[]};
  if(lc.includes('thank')) return{ok:true,clean:'Always a pleasure, Sir.',cmds:[]};
  if(lc.includes('joke')){
    const j=["Why don't scientists trust atoms, Sir? Because they make up everything.","Why did the AI go to therapy, Sir? Too many unresolved issues in its training data."];
    return{ok:true,clean:j[Math.floor(Math.random()*j.length)],cmds:[]};
  }
  return{ok:true,clean:'Understood, Sir. To unlock full AI conversation, please add your OpenAI API key in the Settings panel. I can still execute all system commands directly.',cmds:[]};
}

function aiErr(m){
  if(m.includes('401')||m.includes('invalid_api_key')) return 'Authentication issue, Sir. Your OpenAI API key appears invalid. Please verify it in Settings.';
  if(m.includes('429')) return 'Rate limit reached, Sir. Please wait a moment.';
  if(m.includes('fetch')||m.includes('network')) return 'I cannot reach the AI core, Sir. Please check your internet connection.';
  return 'I encountered a technical difficulty, Sir. Please try again.';
}

// ── CHAT UI ───────────────────────────────────────────────────────────────
function addMsg(who,text){
  const w=chatArea.querySelector('.welcome'); if(w) w.remove();
  const t=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div'); d.className='msg '+who;
  d.innerHTML='<div class="msg-hdr">'+(who==='user'?'YOU':'JARVIS')+' \u00b7 '+t+'</div><div class="msg-bubble">'+fmt(text)+'</div>';
  chatArea.appendChild(d); chatArea.scrollTop=chatArea.scrollHeight;
}
function showTyping(){ const w=chatArea.querySelector('.welcome'); if(w) w.remove(); const id='t'+Date.now(); const d=document.createElement('div'); d.id=id; d.className='typing'; d.innerHTML='<div class="dot"></div><div class="dot"></div><div class="dot"></div>'; chatArea.appendChild(d); chatArea.scrollTop=chatArea.scrollHeight; return id; }
function removeTyping(id){ const e=document.getElementById(id); if(e) e.remove(); }
function fmt(t){ return esc(t).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/`(.*?)`/g,'<code>$1</code>').replace(/\n/g,'<br>'); }
function esc(t){ const d=document.createElement('div'); d.appendChild(document.createTextNode(t)); return d.innerHTML; }

function log(text){
  const t=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div'); d.className='act';
  d.innerHTML='<span class="act-t">'+t+'</span>'+esc(text);
  actBox.insertBefore(d,actBox.firstChild);
  while(actBox.children.length>25) actBox.removeChild(actBox.lastChild);
}

let toastTm=null;
function toast_(msg,dur=3000){ toast.textContent=msg; toast.classList.add('show'); if(toastTm) clearTimeout(toastTm); toastTm=setTimeout(()=>toast.classList.remove('show'),dur); }

// ── STATS ─────────────────────────────────────────────────────────────────
function updateStats(s){
  const ca=$('cpuArc'),cv=$('cpuVal'),ra=$('ramArc'),rv=$('ramVal');
  if(ca&&cv){ ca.style.strokeDashoffset=172-(s.cpu/100)*172; cv.textContent=s.cpu+'%'; ca.style.stroke=s.cpu>80?'#ff3333':s.cpu>60?'#ffaa00':'#00d4ff'; }
  if(ra&&rv){ ra.style.strokeDashoffset=172-(s.ram/100)*172; rv.textContent=s.ram+'%'; ra.style.stroke=s.ram>85?'#ff3333':s.ram>70?'#ffaa00':'#0066ff'; }
  const nb=document.getElementById('netBars');
  if(nb) nb.querySelectorAll('.nb').forEach(b=>{ b.style.height=(Math.random()*80+10)+'%'; });
  const nl=$('netLabel'); if(nl) nl.textContent='UPTIME: '+s.uptime+'m';
}

// ── EVENTS ────────────────────────────────────────────────────────────────
function bindEvents(){
  sendBtn.addEventListener('click',()=>{ const t=userInput.value.trim(); if(t){ userInput.value=''; resize(); process(t); } });
  userInput.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); const t=userInput.value.trim(); if(t){ userInput.value=''; resize(); process(t); } } });
  userInput.addEventListener('input',resize);

  micBtn.addEventListener('click',()=>{
    if(!voice.rec){ toast_('Voice not available in this environment'); return; }
    if(recording){ stopRec(); recording=false; micBtn.classList.remove('recording'); micIcon.textContent='\uD83C\uDF99'; }
    else{ recording=true; micBtn.classList.add('recording'); micIcon.textContent='\uD83D\uDD34'; voiceTranscript.textContent='Listening...'; startRec(); }
  });

  voiceToggle.addEventListener('click',()=>{
    if(voice.continuous){ voice.continuous=false; stopRec(); voiceToggle.classList.remove('on'); voiceToggle.textContent='\u25BA ACTIVATE VOICE'; setState('idle'); log('Voice deactivated'); }
    else{ voice.continuous=true; voiceToggle.classList.add('on'); voiceToggle.textContent='\u25A0 DEACTIVATE VOICE'; startRec(); log('Voice activated'); toast_('Voice mode active — speak your command'); }
  });

  wakeToggle.addEventListener('change',e=>{
    cfg.wakeWordEnabled=e.target.checked;
    if(e.target.checked){ voice.continuous=true; voiceToggle.classList.add('on'); voiceToggle.textContent='\u25A0 DEACTIVATE VOICE'; startRec(); toast_('Wake word mode: Say "Hey JARVIS"'); }
    else{ voice.continuous=false; stopRec(); voiceToggle.classList.remove('on'); voiceToggle.textContent='\u25BA ACTIVATE VOICE'; }
  });

  document.querySelectorAll('.qcmd').forEach(b=>b.addEventListener('click',()=>{ const c=b.getAttribute('data-cmd'); if(c) process(c); }));

  btnMin.addEventListener('click',()=>J&&J.minimize());
  btnClose.addEventListener('click',()=>J?J.hide():window.close());

  btnSettings.addEventListener('click',()=>{
    const v=settingsPanel.style.display!=='none';
    settingsPanel.style.display=v?'none':'block';
    btnSettings.style.color=v?'':'var(--p)';
  });

  $('saveBtn').addEventListener('click',()=>{
    const nc={
      apiKey:$('apiKeyInput').value.trim(),
      model:$('modelSelect').value,
      startWithWindows:$('startupToggle').checked,
      ttsEnabled:$('ttsToggle').checked,
      autoUpdate:$('autoUpdateToggle').checked
    };
    cfg={...cfg,...nc};
    if(J) J.saveCfg(nc);
    updateAIPill();
    settingsPanel.style.display='none'; btnSettings.style.color='';
    toast_('Settings saved, Sir.'); log('Settings updated');
    if(!nc.ttsEnabled&&window.speechSynthesis) window.speechSynthesis.cancel();
  });

  $('checkUpdateBtn').addEventListener('click',()=>{ if(J) J.checkUpdate(); toast_('Checking for updates...',2000); });
  $('viewLogsBtn').addEventListener('click',()=>{ if(J) J.openURL('file://'+encodeURIComponent(J.platform==='win32'?'C:\\Users\\'+encodeURIComponent(process.env?.USERNAME||'')+'\\AppData\\Roaming\\jarvis-ai\\jarvis.log':'~/.config/jarvis-ai/jarvis.log')); });

  userInput.focus();
}

function resize(){ userInput.style.height='auto'; userInput.style.height=Math.min(userInput.scrollHeight,100)+'px'; }

// ── IPC ───────────────────────────────────────────────────────────────────
function bindIPC(){
  if(!J) return;
  J.onStats(s=>updateStats(s));
  J.onVoice(()=>{ if(!recording){ recording=true; micBtn.classList.add('recording'); micIcon.textContent='\uD83D\uDD34'; startRec(); toast_('Voice activated'); } });
  J.onSettings(()=>{ settingsPanel.style.display='block'; btnSettings.style.color='var(--p)'; });
  J.onUpdateStatus(msg=>{
    log('UPDATE: '+msg);
    const lc=msg.toLowerCase();
    if(lc.includes('downloading')||lc.includes('update found')){ setState('updating'); toast_(msg,4000); }
    else if(lc.includes('up to date')) toast_('JARVIS is up to date',2000);
    else if(lc.includes('restarting')){ addMsg('jarvis','Update complete, Sir. Restarting now.'); if(cfg.ttsEnabled) speak('Update complete, Sir. Restarting now.'); toast_('Restarting JARVIS...',3000); }
    else if(msg) toast_(msg,3000);
  });
}

document.addEventListener('DOMContentLoaded', init);
"""

# Write files
files = {
    'src/renderer/index.html': INDEX_HTML,
    'src/renderer/renderer.js': RENDERER_JS,
}

for rel, content in files.items():
    path = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Written: {path} ({len(content)} chars)')

print('All files generated successfully!')
