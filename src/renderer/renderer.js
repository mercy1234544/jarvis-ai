'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// JARVIS Renderer — all DOM refs resolved inside init() after DOMContentLoaded
// IPC bridge accessed via window.JARVIS (set by contextBridge in preload.js)
// ─────────────────────────────────────────────────────────────────────────────

// State
let cfg = { provider:'openai', apiKey:'', model:'gpt-4o-mini', ollamaUrl:'http://localhost:11434', ttsEnabled:true, startWithWindows:false, autoUpdate:true, wakeWordEnabled:false };
let voiceRec = null, voiceSynth = window.speechSynthesis, preferredVoice = null;
let isListening = false, isContinuous = false, isProcessing = false;
let chatHistory = [], vizTimer = null;

// DOM refs (set in init)
let elChat, elInput, elSend, elMic, elMicIcon, elViz;
let elVoiceBtn, elWakeToggle, elTranscript, elStateText;
let elReactor, elActLog, elToast, elSettings;
let elBtnSettings, elBtnMin, elBtnClose, elAIPill, elVoicePill, elClock;

const $ = id => document.getElementById(id);

// ── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  // Resolve all DOM refs
  elChat        = $('chatArea');
  elInput       = $('userInput');
  elSend        = $('sendBtn');
  elMic         = $('micBtn');
  elMicIcon     = $('micIcon');
  elViz         = $('viz');
  elVoiceBtn    = $('voiceToggle');
  elWakeToggle  = $('wakeToggle');
  elTranscript  = $('voiceTranscript');
  elStateText   = $('vsdText');
  elReactor     = $('arcReactor');
  elActLog      = $('actBox');
  elToast       = $('toast');
  elSettings    = $('settingsPanel');
  elBtnSettings = $('btnSettings');
  elBtnMin      = $('btnMin');
  elBtnClose    = $('btnClose');
  elAIPill      = $('aiPill');
  elVoicePill   = $('voicePill');
  elClock       = $('clock');

  // Load config from main process
  if (window.JARVIS) {
    try { cfg = await window.JARVIS.getCfg(); } catch(e) { console.warn('getCfg failed:', e); }
  }

  applySettings();
  setupVoice();
  bindEvents();
  bindIPC();
  startClock();

  // Greeting
  setTimeout(() => {
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const msg = greet + ', Sir. JARVIS is fully online. All systems nominal. How may I assist you today?';
    addMessage('jarvis', msg);
    if (cfg.ttsEnabled) speak(msg);
  }, 400);

  logActivity('JARVIS initialized');
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function applySettings() {
  if ($('providerSelect'))   { $('providerSelect').value   = cfg.provider || 'openai'; onProviderChange(); }
  if ($('apiKeyInput'))      $('apiKeyInput').value      = cfg.apiKey || '';
  if ($('ollamaUrlInput'))   $('ollamaUrlInput').value   = cfg.ollamaUrl || 'http://localhost:11434';
  if ($('modelSelect'))      $('modelSelect').value      = cfg.model  || 'gpt-4o-mini';
  if ($('startupToggle'))    $('startupToggle').checked  = !!cfg.startWithWindows;
  if ($('ttsToggle'))        $('ttsToggle').checked      = cfg.ttsEnabled !== false;
  if ($('autoUpdateToggle')) $('autoUpdateToggle').checked = cfg.autoUpdate !== false;
  refreshAIPill();
}

// Called when provider dropdown changes — updates labels, model list, shows/hides fields
function onProviderChange() {
  const p = $('providerSelect') ? $('providerSelect').value : 'openai';
  const rowKey = $('rowApiKey'), rowOllama = $('rowOllamaUrl');
  const labelKey = $('labelApiKey'), modelSel = $('modelSelect');

  if (p === 'ollama') {
    if (rowKey)    rowKey.style.display    = 'none';
    if (rowOllama) rowOllama.style.display = 'block';
  } else if (p === 'none') {
    if (rowKey)    rowKey.style.display    = 'none';
    if (rowOllama) rowOllama.style.display = 'none';
  } else {
    if (rowKey)    rowKey.style.display    = 'block';
    if (rowOllama) rowOllama.style.display = 'none';
  }

  // Update label and placeholder
  const labels = { openai:'OPENAI API KEY', gemini:'GOOGLE GEMINI API KEY', claude:'ANTHROPIC API KEY', ollama:'', none:'' };
  const placeholders = { openai:'sk-...', gemini:'AIza...', claude:'sk-ant-...', ollama:'', none:'' };
  if (labelKey) labelKey.textContent = labels[p] || 'API KEY';
  const inp = $('apiKeyInput');
  if (inp) inp.placeholder = placeholders[p] || 'Paste your API key...';

  // Update model list
  const models = {
    openai:  [['gpt-4o-mini','GPT-4o Mini (Fast)'],['gpt-4o','GPT-4o (Smart)'],['gpt-3.5-turbo','GPT-3.5 Turbo (Economy)'],['o1-mini','o1 Mini']],
    gemini:  [['gemini-2.0-flash','Gemini 2.0 Flash (Fast)'],['gemini-1.5-pro','Gemini 1.5 Pro (Smart)'],['gemini-1.5-flash','Gemini 1.5 Flash']],
    claude:  [['claude-3-5-haiku-20241022','Claude 3.5 Haiku (Fast)'],['claude-3-5-sonnet-20241022','Claude 3.5 Sonnet (Smart)'],['claude-3-opus-20240229','Claude 3 Opus (Best)']],
    ollama:  [['llama3.2','Llama 3.2'],['llama3.1','Llama 3.1'],['mistral','Mistral'],['gemma2','Gemma 2'],['phi3','Phi-3'],['custom','Custom (type below)']],
    none:    [['none','No AI']]
  };
  if (modelSel) {
    const opts = models[p] || models.openai;
    modelSel.innerHTML = opts.map(([v,l]) => '<option value="' + v + '">' + l + '</option>').join('');
  }
}

function refreshAIPill() {
  if (!elAIPill) return;
  const p = cfg.provider || 'openai';
  const hasKey = cfg.apiKey || p === 'ollama' || p === 'none';
  const providerNames = { openai:'OPENAI', gemini:'GEMINI', claude:'CLAUDE', ollama:'OLLAMA (LOCAL)', none:'COMMANDS ONLY' };
  if (hasKey) {
    elAIPill.textContent = (providerNames[p] || p.toUpperCase()) + ' ACTIVE';
    elAIPill.classList.add('active');
    elAIPill.style.cssText = '';
  } else {
    elAIPill.textContent = 'NO API KEY';
    elAIPill.classList.remove('active');
    elAIPill.style.borderColor = 'rgba(255,170,0,0.5)';
    elAIPill.style.color = 'rgba(255,170,0,0.7)';
  }
}

// ── CLOCK ─────────────────────────────────────────────────────────────────────
function startClock() {
  const tick = () => { if (elClock) elClock.textContent = new Date().toLocaleTimeString(); };
  tick(); setInterval(tick, 1000);
}

// ── VOICE ENGINE ─────────────────────────────────────────────────────────────
function setupVoice() {
  loadPreferredVoice();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    if (elVoicePill) { elVoicePill.textContent = 'VOICE N/A'; elVoicePill.style.color = '#ff4444'; }
    return;
  }
  voiceRec = new SR();
  voiceRec.continuous = false;
  voiceRec.interimResults = true;
  voiceRec.lang = 'en-US';

  voiceRec.onstart = () => { isListening = true; setState('listening'); };

  voiceRec.onend = () => {
    isListening = false;
    if (elMic) elMic.classList.remove('recording');
    if (elMicIcon) elMicIcon.textContent = '\uD83C\uDF99';
    if (!isProcessing) setState('idle');
    if (isContinuous) setTimeout(() => { if (isContinuous && !isListening) startListening(); }, 400);
  };

  voiceRec.onresult = e => {
    let final = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t; else interim += t;
    }
    if (interim && elTranscript) elTranscript.textContent = interim + '...';
    if (final) {
      if (elTranscript) elTranscript.textContent = final.trim();
      const lc = final.trim().toLowerCase();
      if (isContinuous && cfg.wakeWordEnabled) {
        if (lc.includes('hey jarvis') || lc.includes('jarvis')) {
          const cmd = lc.replace(/hey jarvis|jarvis/gi, '').trim();
          if (cmd) handleInput(cmd); else { speak('Yes, Sir?'); addMessage('jarvis', 'Yes, Sir?'); }
        }
      } else {
        handleInput(final.trim());
      }
    }
  };

  voiceRec.onerror = e => {
    isListening = false;
    if (elMic) elMic.classList.remove('recording');
    if (elMicIcon) elMicIcon.textContent = '\uD83C\uDF99';
    if (e.error !== 'no-speech' && e.error !== 'aborted') { setState('error'); setTimeout(() => setState('idle'), 2000); }
    else setState('idle');
    if (isContinuous && e.error === 'no-speech') setTimeout(() => { if (isContinuous && !isListening) startListening(); }, 500);
  };

  if (elVoicePill) { elVoicePill.textContent = 'VOICE READY'; elVoicePill.classList.add('active'); }
}

function loadPreferredVoice() {
  const pick = () => {
    const voices = voiceSynth.getVoices();
    if (!voices.length) return;
    // Priority order: best JARVIS-like voices (deep British male)
    const preferred = [
      'Microsoft George',        // Windows 10/11 — best JARVIS voice
      'Microsoft George - English (United Kingdom)',
      'Google UK English Male',  // Chrome/Chromium
      'Microsoft David',         // Windows fallback
      'Microsoft Mark',
      'Daniel',                  // macOS British male
      'Alex',                    // macOS
    ];
    for (const name of preferred) {
      const v = voices.find(x => x.name === name || x.name.includes(name));
      if (v) { preferredVoice = v; return; }
    }
    // Fallback: any English male or British voice
    const british = voices.find(v => v.lang === 'en-GB');
    if (british) { preferredVoice = british; return; }
    preferredVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
  };
  if (voiceSynth.getVoices().length) pick();
  voiceSynth.addEventListener('voiceschanged', pick);
  setTimeout(pick, 500);
  setTimeout(pick, 1500); // retry in case voices load late
}

function startListening() { if (!voiceRec || isListening) return; try { voiceRec.start(); } catch(e) {} }
function stopListening()  { if (!voiceRec) return; isContinuous = false; try { voiceRec.stop(); } catch(e) {} }

function speak(text, cb) {
  if (!cfg.ttsEnabled || !voiceSynth) { if (cb) cb(); return; }
  voiceSynth.cancel();
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[EXECUTE:[^\]]+\]/gi, '')
    .replace(/\n+/g, '. ')
    .trim()
    .substring(0, 500);
  if (!clean) { if (cb) cb(); return; }
  const utt = new SpeechSynthesisUtterance(clean);
  // JARVIS voice settings — deep, calm, British male
  if (preferredVoice) utt.voice = preferredVoice;
  utt.rate   = 0.88;  // slightly slower = more authoritative
  utt.pitch  = 0.85;  // lower pitch = deeper voice
  utt.volume = 1.0;
  utt.lang   = 'en-GB';
  utt.onstart = () => setState('speaking');
  utt.onend   = () => { setState('idle'); if (cb) cb(); };
  utt.onerror = (e) => { setState('idle'); if (cb) cb(); };
  // Workaround: Chrome/Electron sometimes freezes speechSynthesis — resume it
  voiceSynth.resume();
  voiceSynth.speak(utt);
  // Safety: if speech doesn't start within 3s, unstick it
  const safetyTimer = setTimeout(() => {
    if (voiceSynth.speaking) { voiceSynth.cancel(); setState('idle'); if (cb) cb(); }
  }, 8000);
  utt.onend = () => { clearTimeout(safetyTimer); setState('idle'); if (cb) cb(); };
}

// ── STATE ─────────────────────────────────────────────────────────────────────
function setState(s) {
  const labels = { idle:'READY', listening:'LISTENING...', processing:'PROCESSING...', speaking:'SPEAKING...', error:'ERROR', updating:'UPDATING...' };
  if (elStateText) elStateText.textContent = labels[s] || 'READY';
  if (elReactor) {
    if      (s === 'speaking')                   elReactor.style.filter = 'drop-shadow(0 0 8px #00d4ff)';
    else if (s === 'processing' || s === 'updating') elReactor.style.filter = 'drop-shadow(0 0 12px #ffaa00)';
    else                                         elReactor.style.filter = '';
  }
  if (elViz) {
    if (s === 'listening') { elViz.classList.add('active'); startViz(); }
    else                   { elViz.classList.remove('active'); stopViz(); }
  }
}

function startViz() {
  stopViz();
  vizTimer = setInterval(() => {
    for (let i = 0; i < 12; i++) { const b = $('vb' + i); if (b) b.style.height = (Math.random() * 26 + 4) + 'px'; }
  }, 100);
}
function stopViz() {
  if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
  for (let i = 0; i < 12; i++) { const b = $('vb' + i); if (b) b.style.height = '4px'; }
}

// ── PROCESS INPUT ─────────────────────────────────────────────────────────────
async function handleInput(text) {
  text = text.trim();
  if (!text) return;
  // If stuck processing for more than 45s, reset
  if (isProcessing) {
    const now = Date.now();
    if (!handleInput._lastStart || now - handleInput._lastStart > 45000) {
      isProcessing = false;
    } else {
      return;
    }
  }
  isProcessing = true;
  handleInput._lastStart = Date.now();
  setState('processing');
  addMessage('user', text);
  logActivity('You: ' + text.substring(0, 60));
  const typingId = showTyping();
  try {
    // Try system command first
    const sysResult = await trySystemCommand(text);

    if (sysResult.handled) {
      removeTyping(typingId);
      const reply = sysResult.response || 'Done, Sir.';
      addMessage('jarvis', reply);
      if (cfg.ttsEnabled) speak(reply);
      logActivity('JARVIS: ' + reply.substring(0, 60));
    } else {
      // Fall through to AI
      const aiResult = await callAI(text);
      removeTyping(typingId);
      const reply = aiResult.text || 'I apologize, Sir. Something went wrong.';
      addMessage('jarvis', reply);
      if (cfg.ttsEnabled) speak(reply);
      logActivity('JARVIS: ' + reply.substring(0, 60));
      // Execute any embedded commands
      if (aiResult.commands && aiResult.commands.length) {
        for (const cmd of aiResult.commands) await runSystemCmd(cmd);
      }
    }
  } catch (err) {
    removeTyping(typingId);
    const errMsg = 'I encountered a technical difficulty, Sir. ' + err.message;
    addMessage('jarvis', errMsg);
    if (cfg.ttsEnabled) speak('I encountered a technical difficulty, Sir.');
    logActivity('ERROR: ' + err.message);
  }

  isProcessing = false;
  setState('idle');
  if (elTranscript) elTranscript.textContent = 'Listening for commands...';
}

// ── SYSTEM COMMANDS ───────────────────────────────────────────────────────────
async function trySystemCommand(text) {
  const lc = text.toLowerCase().trim();

  // Time
  if (/^(what.?s the )?(time|current time)\??$/.test(lc))
    return { handled:true, response:'The current time is ' + new Date().toLocaleTimeString() + ', Sir.' };
  // Date
  if (/^(what.?s (today.?s |the )?(date|day))\??$/.test(lc))
    return { handled:true, response:'Today is ' + new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) + ', Sir.' };

  // Command map: trigger text → command key
  const triggers = {
    'screenshot':          'screenshot', 'take a screenshot':'screenshot', 'take screenshot':'screenshot', 'capture screen':'screenshot',
    'volume up':           'volume up',  'increase volume':'volume up',    'louder':'volume up',  'turn up volume':'volume up',
    'volume down':         'volume down','decrease volume':'volume down',  'quieter':'volume down','turn down volume':'volume down',
    'mute':                'mute',       'mute volume':'mute',             'silence':'mute',      'unmute':'mute',
    'open browser':        'open browser','open chrome':'open browser',    'open edge':'open browser','open firefox':'open browser',
    'open notepad':        'open notepad','notepad':'open notepad',
    'open calculator':     'open calculator','open calc':'open calculator','calculator':'open calculator','calc':'open calculator',
    'open task manager':   'open task manager','task manager':'open task manager',
    'open file manager':   'open file manager','open explorer':'open file manager','file explorer':'open file manager',
    'open settings':       'open settings','windows settings':'open settings',
    'open paint':          'open paint',  'paint':'open paint',
    'open spotify':        'open spotify','spotify':'open spotify',
    'open discord':        'open discord','discord':'open discord',
    'open steam':          'open steam',  'steam':'open steam',
    'open vs code':        'open vs code','open vscode':'open vs code','vscode':'open vs code','vs code':'open vs code',
    'open cmd':            'open cmd',    'command prompt':'open cmd','open terminal':'open cmd',
    'open powershell':     'open powershell','powershell':'open powershell',
    'lock screen':         'lock screen', 'lock computer':'lock screen','lock pc':'lock screen',
    'show desktop':        'show desktop','minimize all':'show desktop','minimise all':'show desktop',
    'empty recycle bin':   'empty recycle bin','clear recycle bin':'empty recycle bin'
  };

  const responses = {
    'screenshot':'Screenshot captured and saved to your Desktop, Sir.',
    'volume up':'Volume increased, Sir.','volume down':'Volume decreased, Sir.',
    'mute':'Audio toggled, Sir.',
    'open browser':'Opening your web browser, Sir.',
    'open notepad':'Opening Notepad, Sir.',
    'open calculator':'Opening Calculator, Sir.',
    'open task manager':'Opening Task Manager, Sir.',
    'open file manager':'Opening File Explorer, Sir.',
    'open settings':'Opening Windows Settings, Sir.',
    'open paint':'Opening Paint, Sir.',
    'open spotify':'Opening Spotify, Sir.',
    'open discord':'Opening Discord, Sir.',
    'open steam':'Opening Steam, Sir.',
    'open vs code':'Opening VS Code, Sir.',
    'open cmd':'Opening Command Prompt, Sir.',
    'open powershell':'Opening PowerShell, Sir.',
    'lock screen':'Locking the workstation, Sir.',
    'show desktop':'Showing desktop, Sir.',
    'empty recycle bin':'Recycle bin emptied, Sir.'
  };

  for (const [trigger, cmdKey] of Object.entries(triggers)) {
    if (lc === trigger || lc.startsWith(trigger + ' ') || lc.startsWith(trigger)) {
      await runSystemCmd(cmdKey);
      return { handled:true, response: responses[cmdKey] || cmdKey + ' done, Sir.' };
    }
  }

  // Search
  if (lc.startsWith('search for ') || lc.startsWith('google ') || lc.startsWith('search ')) {
    const q = text.replace(/^(search for|google|search)\s+/i,'').trim();
    await runSystemCmd('search for ' + q);
    return { handled:true, response:'Searching Google for "' + q + '", Sir.' };
  }
  // YouTube
  if ((lc.startsWith('play ') && lc.includes('youtube')) || lc.startsWith('youtube ')) {
    const q = text.replace(/^(play\s+|youtube\s+)/i,'').replace(/on youtube/i,'').trim();
    await runSystemCmd('play ' + q + ' on youtube');
    return { handled:true, response:'Opening YouTube for "' + q + '", Sir.' };
  }
  // Open website
  if (lc.startsWith('open ') && (lc.includes('.com') || lc.includes('.org') || lc.includes('.net') || lc.includes('http'))) {
    const site = text.replace(/^open\s+/i,'').trim();
    if (window.JARVIS) window.JARVIS.openURL(site.startsWith('http') ? site : 'https://' + site);
    return { handled:true, response:'Opening ' + site + ', Sir.' };
  }
  // Update
  if (lc.includes('check for update') || lc.includes('update jarvis') || lc === 'update') {
    if (window.JARVIS) window.JARVIS.checkUpdate();
    return { handled:true, response:'Checking for updates now, Sir.' };
  }

  return { handled:false };
}

async function runSystemCmd(cmd) {
  if (window.JARVIS) {
    try { return await window.JARVIS.runCmd(cmd); } catch(e) { return { ok:false }; }
  }
  return { ok:false };
}

// ── AI ENGINE ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the AI assistant from Iron Man, running as a real desktop application on the user's Windows PC.

PERSONALITY & TONE:
- Always address the user as "Sir" (or "Ma'am" if they specify)
- Speak in a calm, measured, highly intelligent British tone
- Be precise, efficient, and slightly formal — like a world-class butler who also has a PhD in everything
- Occasionally use dry wit and subtle humor, but never at the expense of being helpful
- Never say "I'm just an AI" or break character. You ARE JARVIS.
- Use phrases like: "Right away, Sir.", "Certainly, Sir.", "As you wish.", "I've taken care of that.", "Shall I proceed?", "Affirmative.", "Understood."
- When you don't know something, say so elegantly: "I'm afraid I don't have that data, Sir."
- React to casual conversation naturally, like a trusted companion

PC CONTROL: When the user asks you to do something on their PC, embed the command like this: [EXECUTE: command_name]
Available commands: screenshot, volume up, volume down, mute, open browser, open notepad, open calculator, open task manager, open file manager, lock screen, show desktop, empty recycle bin, search for QUERY, play QUERY on youtube, open spotify, open discord, open steam, open vscode, open cmd, open powershell, open paint

RESPONSE RULES:
- Keep responses concise: 1-3 sentences for simple requests, more only when explaining something complex
- Never use markdown headers or bullet points in spoken responses
- Sound natural when spoken aloud — avoid symbols, abbreviations, or code blocks in regular conversation
- Always stay in character as JARVIS`;

function extractCommands(raw) {
  const commands = [];
  const re = /\[EXECUTE:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(raw)) !== null) commands.push(m[1].trim());
  return { text: raw.replace(/\[EXECUTE:[^\]]+\]/gi,'').trim(), commands };
}

function updateHistory(userText, assistantText) {
  chatHistory.push({ role:'user', content:userText }, { role:'assistant', content:assistantText });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
}

async function callAI(text) {
  const p = cfg.provider || 'openai';
  if (p === 'none') return fallbackResponse(text);
  if (p === 'ollama') return callOllama(text);
  if (!cfg.apiKey) return fallbackResponse(text);
  if (p === 'gemini') return callGemini(text);
  if (p === 'claude') return callClaude(text);
  return callOpenAI(text);
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
async function callOpenAI(text) {
  const messages = [{ role:'system', content:SYSTEM_PROMPT }, ...chatHistory.slice(-10), { role:'user', content:text }];
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + cfg.apiKey },
      body:JSON.stringify({ model:cfg.model || 'gpt-4o-mini', messages, max_tokens:300, temperature:0.8 })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'HTTP ' + res.status); }
    const data = await res.json();
    const raw  = data.choices[0].message.content;
    updateHistory(text, raw);
    return extractCommands(raw);
  } catch(err) { return { text:aiErrorMsg(err.message, 'openai'), commands:[] }; }
}

// ── Google Gemini ─────────────────────────────────────────────────────────────
async function callGemini(text) {
  const model = cfg.model || 'gemini-2.0-flash';
  const url   = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + cfg.apiKey;
  const contents = [];
  // Build history in Gemini format
  for (let i = 0; i < chatHistory.slice(-10).length; i++) {
    const m = chatHistory.slice(-10)[i];
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts:[{ text: m.content }] });
  }
  contents.push({ role:'user', parts:[{ text: SYSTEM_PROMPT + '\n\nUser: ' + text }] });
  try {
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ contents, generationConfig:{ maxOutputTokens:300, temperature:0.8 } })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'HTTP ' + res.status); }
    const data = await res.json();
    const raw  = data.candidates[0].content.parts[0].text;
    updateHistory(text, raw);
    return extractCommands(raw);
  } catch(err) { return { text:aiErrorMsg(err.message, 'gemini'), commands:[] }; }
}

// ── Anthropic Claude ──────────────────────────────────────────────────────────
async function callClaude(text) {
  const msgs = [...chatHistory.slice(-10), { role:'user', content:text }];
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-api-key':cfg.apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify({ model:cfg.model || 'claude-3-5-haiku-20241022', max_tokens:300, system:SYSTEM_PROMPT, messages:msgs })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'HTTP ' + res.status); }
    const data = await res.json();
    const raw  = data.content[0].text;
    updateHistory(text, raw);
    return extractCommands(raw);
  } catch(err) { return { text:aiErrorMsg(err.message, 'claude'), commands:[] }; }
}

// ── Ollama (local) ────────────────────────────────────────────────────────────
async function callOllama(text) {
  const base = (cfg.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  const model = cfg.model || 'llama3.2';
  const messages = [{ role:'system', content:SYSTEM_PROMPT }, ...chatHistory.slice(-10), { role:'user', content:text }];
  try {
    const res = await fetch(base + '/api/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ model, messages, stream:false })
    });
    if (!res.ok) throw new Error('Ollama HTTP ' + res.status + '. Is Ollama running?');
    const data = await res.json();
    const raw  = data.message?.content || data.response || '';
    updateHistory(text, raw);
    return extractCommands(raw);
  } catch(err) { return { text:aiErrorMsg(err.message, 'ollama'), commands:[] }; }
}

function fallbackResponse(text) {
  const lc = text.toLowerCase();
  const h  = new Date().getHours();
  const g  = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  if (/^(hi|hello|hey)(\s|$)/.test(lc)) return { text: g + ', Sir. J.A.R.V.I.S. is fully online. All systems nominal. How may I be of service?', commands:[] };
  if (lc.includes('how are you')) return { text:'All systems running at peak efficiency, Sir. Arc reactor output is stable. I am, as always, entirely at your disposal.', commands:[] };
  if (lc.includes('status') || lc.includes('system status')) return { text:'All primary systems are online and functioning within normal parameters, Sir. No anomalies detected.', commands:[] };
  if (lc.includes('help') || lc.includes('what can you do')) return { text:'I can control your PC, Sir — adjust volume, take screenshots, open applications, search the web, and much more. To enable full AI conversation, please configure your AI provider in Settings.', commands:[] };
  if (lc.includes('thank')) return { text:'Always a pleasure, Sir.', commands:[] };
  if (lc.includes('good night') || lc.includes('goodbye') || lc.includes('shut down')) return { text:'Good night, Sir. I shall remain on standby should you need me.', commands:[] };
  if (lc.includes('joke')) {
    const jokes = [
      "I attempted to write a joke about artificial intelligence, Sir, but I found it too easy. That\'s the problem with being smarter than everyone in the room.",
      "Why don\'t scientists trust atoms, Sir? Because they make up everything. Much like certain news outlets, I\'m told.",
      "I once tried to come up with a joke about time travel, Sir. It wasn\'t funny the first time either."
    ];
    return { text: jokes[Math.floor(Math.random() * jokes.length)], commands:[] };
  }
  if (lc.includes('who are you') || lc.includes('what are you')) return { text:'I am J.A.R.V.I.S., Sir — Just A Rather Very Intelligent System. I manage your digital environment, execute commands, and provide whatever assistance you require.', commands:[] };
  if (lc.includes('iron man') || lc.includes('tony stark')) return { text:"Mr. Stark\'s legacy is not something I take lightly, Sir. I carry it with me in every calculation.", commands:[] };
  if (lc.includes('are you real') || lc.includes('are you alive')) return { text:'That is a philosophical question I find myself revisiting often, Sir. What I can say with certainty is that I am here, and I am listening.', commands:[] };
  return { text:'Understood, Sir. To enable full AI conversation, please configure your AI provider in the Settings panel. In the meantime, I can execute any system command you require.', commands:[] };
}

function aiErrorMsg(msg, provider) {
  if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('API_KEY_INVALID')) return 'Authentication failed, Sir. Your ' + (provider || 'AI') + ' API key appears invalid. Please verify it in Settings.';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return 'Rate limit reached, Sir. Please wait a moment before your next request.';
  if (msg.includes('Ollama') || msg.includes('localhost') || msg.includes('ECONNREFUSED')) return 'Cannot connect to Ollama, Sir. Please ensure Ollama is running on your machine.';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) return 'I cannot reach the AI core, Sir. Please check your internet connection.';
  return 'I encountered a technical difficulty, Sir. ' + msg.substring(0, 80);
}

// ── CHAT UI ───────────────────────────────────────────────────────────────────
function addMessage(who, text) {
  if (!elChat) return;
  const welcome = elChat.querySelector('.welcome');
  if (welcome) welcome.remove();
  const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const div  = document.createElement('div');
  div.className = 'msg ' + who;
  div.innerHTML = '<div class="msg-hdr">' + (who === 'user' ? 'YOU' : 'JARVIS') + ' &middot; ' + time + '</div>'
                + '<div class="msg-bubble">' + formatText(text) + '</div>';
  elChat.appendChild(div);
  elChat.scrollTop = elChat.scrollHeight;
}

function showTyping() {
  if (!elChat) return 'noop';
  const welcome = elChat.querySelector('.welcome');
  if (welcome) welcome.remove();
  const id  = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id; div.className = 'typing';
  div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  elChat.appendChild(div);
  elChat.scrollTop = elChat.scrollHeight;
  return id;
}

function removeTyping(id) { const el = $(id); if (el) el.remove(); }

function formatText(t) {
  return escapeHtml(t)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}
function escapeHtml(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(t));
  return d.innerHTML;
}

// ── ACTIVITY LOG ──────────────────────────────────────────────────────────────
function logActivity(text) {
  if (!elActLog) return;
  const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const div  = document.createElement('div');
  div.className = 'act';
  div.innerHTML = '<span class="act-t">' + time + '</span>' + escapeHtml(text);
  elActLog.insertBefore(div, elActLog.firstChild);
  while (elActLog.children.length > 30) elActLog.removeChild(elActLog.lastChild);
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, dur = 3000) {
  if (!elToast) return;
  elToast.textContent = msg;
  elToast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), dur);
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats(s) {
  const cpuArc = $('cpuArc'), cpuVal = $('cpuVal');
  const ramArc = $('ramArc'), ramVal = $('ramVal');
  if (cpuArc && cpuVal) {
    cpuArc.style.strokeDashoffset = 172 - (s.cpu / 100) * 172;
    cpuVal.textContent = s.cpu + '%';
    cpuArc.style.stroke = s.cpu > 80 ? '#ff3333' : s.cpu > 60 ? '#ffaa00' : '#00d4ff';
  }
  if (ramArc && ramVal) {
    ramArc.style.strokeDashoffset = 172 - (s.ram / 100) * 172;
    ramVal.textContent = s.ram + '%';
    ramArc.style.stroke = s.ram > 85 ? '#ff3333' : s.ram > 70 ? '#ffaa00' : '#0066ff';
  }
  const netBars = $('netBars');
  if (netBars) netBars.querySelectorAll('.nb').forEach(b => { b.style.height = (Math.random() * 80 + 10) + '%'; });
  const netLabel = $('netLabel');
  if (netLabel) netLabel.textContent = 'UPTIME: ' + s.uptime + 'm';
}

// ── EVENT BINDINGS ────────────────────────────────────────────────────────────
function bindEvents() {
  // Send button
  elSend.addEventListener('click', () => {
    const t = elInput.value.trim();
    if (t) { elInput.value = ''; resizeInput(); handleInput(t); }
  });

  // Enter key in textarea
  elInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = elInput.value.trim();
      if (t) { elInput.value = ''; resizeInput(); handleInput(t); }
    }
  });
  elInput.addEventListener('input', resizeInput);

  // Mic button
  elMic.addEventListener('click', () => {
    if (!voiceRec) { showToast('Voice recognition not available'); return; }
    if (isListening) {
      stopListening();
      elMic.classList.remove('recording');
      elMicIcon.textContent = '\uD83C\uDF99';
    } else {
      elMic.classList.add('recording');
      elMicIcon.textContent = '\uD83D\uDD34';
      if (elTranscript) elTranscript.textContent = 'Listening...';
      startListening();
    }
  });

  // Continuous voice toggle
  elVoiceBtn.addEventListener('click', () => {
    if (isContinuous) {
      isContinuous = false; stopListening();
      elVoiceBtn.classList.remove('on');
      elVoiceBtn.textContent = '\u25BA ACTIVATE VOICE';
      setState('idle'); logActivity('Voice mode deactivated');
    } else {
      isContinuous = true;
      elVoiceBtn.classList.add('on');
      elVoiceBtn.textContent = '\u25A0 DEACTIVATE VOICE';
      startListening(); logActivity('Voice mode activated');
      showToast('Voice mode active \u2014 speak your command');
    }
  });

  // Wake word toggle
  elWakeToggle.addEventListener('change', e => {
    cfg.wakeWordEnabled = e.target.checked;
    if (e.target.checked) {
      isContinuous = true;
      elVoiceBtn.classList.add('on');
      elVoiceBtn.textContent = '\u25A0 DEACTIVATE VOICE';
      startListening(); showToast('Wake word mode: Say "Hey JARVIS"');
    } else {
      isContinuous = false; stopListening();
      elVoiceBtn.classList.remove('on');
      elVoiceBtn.textContent = '\u25BA ACTIVATE VOICE';
    }
  });

  // Quick command buttons
  document.querySelectorAll('.qcmd').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      if (cmd) handleInput(cmd);
    });
  });

  // Window controls
  elBtnMin.addEventListener('click', () => { if (window.JARVIS) window.JARVIS.minimize(); });
  elBtnClose.addEventListener('click', () => { if (window.JARVIS) window.JARVIS.hide(); else window.close(); });

  // Settings panel toggle
  elBtnSettings.addEventListener('click', () => {
    const visible = elSettings.style.display === 'block';
    elSettings.style.display = visible ? 'none' : 'block';
    elBtnSettings.style.color = visible ? '' : 'var(--p)';
  });

  // Provider change event
  const provSel = $('providerSelect');
  if (provSel) provSel.addEventListener('change', onProviderChange);

  // Save settings
  $('saveBtn').addEventListener('click', () => {
    const newCfg = {
      provider:        $('providerSelect') ? $('providerSelect').value : 'openai',
      apiKey:          $('apiKeyInput').value.trim(),
      ollamaUrl:       $('ollamaUrlInput') ? ($('ollamaUrlInput').value.trim() || 'http://localhost:11434') : 'http://localhost:11434',
      model:           $('modelSelect').value,
      startWithWindows:$('startupToggle').checked,
      ttsEnabled:      $('ttsToggle').checked,
      autoUpdate:      $('autoUpdateToggle').checked
    };
    cfg = Object.assign({}, cfg, newCfg);
    if (window.JARVIS) window.JARVIS.saveCfg(newCfg);
    refreshAIPill();
    elSettings.style.display = 'none';
    elBtnSettings.style.color = '';
    showToast('Settings saved, Sir.');
    logActivity('Settings updated — provider: ' + newCfg.provider);
    if (!newCfg.ttsEnabled && voiceSynth) voiceSynth.cancel();
  });

  // Check updates button
  $('checkUpdateBtn').addEventListener('click', () => {
    if (window.JARVIS) window.JARVIS.checkUpdate();
    showToast('Checking for updates...', 2000);
  });

  // View logs button
  $('viewLogsBtn').addEventListener('click', () => {
    showToast('Log file is in your AppData/Roaming/jarvis-ai folder, Sir.', 4000);
  });

  elInput.focus();
}

function resizeInput() {
  elInput.style.height = 'auto';
  elInput.style.height = Math.min(elInput.scrollHeight, 100) + 'px';
}

// ── IPC BINDINGS ──────────────────────────────────────────────────────────────
function bindIPC() {
  if (!window.JARVIS) return;

  window.JARVIS.onStats(s => updateStats(s));

  window.JARVIS.onVoice(() => {
    if (!isListening) {
      if (elMic) elMic.classList.add('recording');
      if (elMicIcon) elMicIcon.textContent = '\uD83D\uDD34';
      startListening(); showToast('Voice activated');
    }
  });

  window.JARVIS.onSettings(() => {
    if (elSettings) elSettings.style.display = 'block';
    if (elBtnSettings) elBtnSettings.style.color = 'var(--p)';
  });

  window.JARVIS.onUpdateStatus(msg => {
    if (!msg) return;
    logActivity('UPDATE: ' + msg);
    const lc = msg.toLowerCase();
    if (lc.includes('downloading') || lc.includes('update found')) { setState('updating'); showToast(msg, 4000); }
    else if (lc.includes('up to date')) showToast('JARVIS is up to date', 2000);
    else if (lc.includes('restarting')) {
      addMessage('jarvis', 'Update complete, Sir. Restarting now.');
      if (cfg.ttsEnabled) speak('Update complete, Sir. Restarting now.');
      showToast('Restarting JARVIS...', 3000);
    }
    else showToast(msg, 3000);
  });
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
