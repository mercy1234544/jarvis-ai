'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// JARVIS Renderer
// KEY FIX: window.JARVIS is set by contextBridge AFTER DOM loads.
// We use a getter function getJ() instead of capturing it at top-level.
// ─────────────────────────────────────────────────────────────────────────────

// Lazy IPC bridge getter — always fresh, never null
function getJ() { return window.JARVIS || null; }

// Config defaults
let cfg = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  ollamaUrl: 'http://localhost:11434',
  ttsEnabled: true,
  startWithWindows: false,
  autoUpdate: true,
  wakeWordEnabled: false,
  elevenKey: '',
  elevenVoice: 'onwK4e9ZLuTAKqWW03F9'
};

// Voice state
// STATES: idle → listening → processing → speaking → idle
let voiceState = 'idle';
let voiceRec = null;
let voiceContinuous = false;
let voiceRecording = false; // single-shot mic button mode

// Chat state
let chatHistory = [];
let isProcessing = false;
let processingTimer = null;

// Viz
let vizInt = null;

// ── DOM REFS (set after DOMContentLoaded) ────────────────────────────────────
let chatArea, userInput, sendBtn, micBtn, micIcon, viz;
let voiceToggle, wakeToggle, voiceTranscript, vsdText;
let arcReactor, actBox, toastEl, settingsPanel;
let btnSettings, btnMin, btnClose, aiPill, voicePill, clock;

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Resolve DOM refs
  chatArea      = document.getElementById('chatArea');
  userInput     = document.getElementById('userInput');
  sendBtn       = document.getElementById('sendBtn');
  micBtn        = document.getElementById('micBtn');
  micIcon       = document.getElementById('micIcon');
  viz           = document.getElementById('viz');
  voiceToggle   = document.getElementById('voiceToggle');
  wakeToggle    = document.getElementById('wakeToggle');
  voiceTranscript = document.getElementById('voiceTranscript');
  vsdText       = document.getElementById('vsdText');
  arcReactor    = document.getElementById('arcReactor');
  actBox        = document.getElementById('actBox');
  toastEl       = document.getElementById('toast');
  settingsPanel = document.getElementById('settingsPanel');
  btnSettings   = document.getElementById('btnSettings');
  btnMin        = document.getElementById('btnMin');
  btnClose      = document.getElementById('btnClose');
  aiPill        = document.getElementById('aiPill');
  voicePill     = document.getElementById('voicePill');
  clock         = document.getElementById('clock');

  // Load config
  const j = getJ();
  if (j) {
    try { cfg = await j.getCfg(); } catch(e) { console.warn('getCfg:', e); }
  }

  applySettings();
  setupVoice();
  bindEvents();
  bindIPC();
  startClock();
  startStats();

  // Greeting
  setTimeout(() => {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const msg = g + ', Sir. JARVIS is fully online. All systems nominal. How may I assist you today?';
    addMsg('jarvis', msg);
    speak(msg);
  }, 500);

  logAct('JARVIS initialized');
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function applySettings() {
  const ps = document.getElementById('providerSelect');
  if (ps) { ps.value = cfg.provider || 'openai'; onProviderChange(); }
  const ak = document.getElementById('apiKeyInput');
  if (ak) ak.value = cfg.apiKey || '';
  const ou = document.getElementById('ollamaUrlInput');
  if (ou) ou.value = cfg.ollamaUrl || 'http://localhost:11434';
  const ms = document.getElementById('modelSelect');
  if (ms) ms.value = cfg.model || 'gpt-4o-mini';
  const st = document.getElementById('startupToggle');
  if (st) st.checked = !!cfg.startWithWindows;
  const tt = document.getElementById('ttsToggle');
  if (tt) tt.checked = cfg.ttsEnabled !== false;
  const ek = document.getElementById('elevenKeyInput');
  if (ek) ek.value = cfg.elevenKey || '';
  const ev = document.getElementById('elevenVoiceSelect');
  if (ev && cfg.elevenVoice) ev.value = cfg.elevenVoice;
  const au = document.getElementById('autoUpdateToggle');
  if (au) au.checked = cfg.autoUpdate !== false;
  refreshAIPill();
}

function onProviderChange() {
  const p = document.getElementById('providerSelect') ? document.getElementById('providerSelect').value : 'openai';
  const rowKey = document.getElementById('rowApiKey');
  const rowOllama = document.getElementById('rowOllamaUrl');
  const labelKey = document.getElementById('labelApiKey');
  const modelSel = document.getElementById('modelSelect');

  if (p === 'ollama') {
    if (rowKey) rowKey.style.display = 'none';
    if (rowOllama) rowOllama.style.display = 'block';
  } else if (p === 'none') {
    if (rowKey) rowKey.style.display = 'none';
    if (rowOllama) rowOllama.style.display = 'none';
  } else {
    if (rowKey) rowKey.style.display = 'block';
    if (rowOllama) rowOllama.style.display = 'none';
  }

  const labels = { openai:'OPENAI API KEY', gemini:'GOOGLE GEMINI API KEY', claude:'ANTHROPIC API KEY', ollama:'', none:'' };
  const placeholders = { openai:'sk-...', gemini:'AIza...', claude:'sk-ant-...', ollama:'', none:'' };
  if (labelKey) labelKey.textContent = labels[p] || 'API KEY';
  const inp = document.getElementById('apiKeyInput');
  if (inp) inp.placeholder = placeholders[p] || 'Paste your API key...';

  const models = {
    openai:  [['gpt-4o-mini','GPT-4o Mini (Fast)'],['gpt-4o','GPT-4o (Smart)'],['gpt-3.5-turbo','GPT-3.5 Turbo (Economy)'],['o1-mini','o1 Mini']],
    gemini:  [['gemini-2.0-flash-exp','Gemini 2.0 Flash (Fast)'],['gemini-1.5-pro','Gemini 1.5 Pro (Smart)'],['gemini-1.5-flash','Gemini 1.5 Flash']],
    claude:  [['claude-3-5-haiku-20241022','Claude 3.5 Haiku (Fast)'],['claude-3-5-sonnet-20241022','Claude 3.5 Sonnet (Smart)'],['claude-3-opus-20240229','Claude 3 Opus (Best)']],
    ollama:  [['llama3.2','Llama 3.2'],['llama3.1','Llama 3.1'],['mistral','Mistral'],['gemma2','Gemma 2'],['phi3','Phi-3 (Fast)'],['deepseek-r1','DeepSeek R1']],
    none:    [['none','No AI']]
  };
  if (modelSel) {
    const opts = models[p] || models.openai;
    modelSel.innerHTML = opts.map(([v,l]) => '<option value="' + v + '">' + l + '</option>').join('');
    if (cfg.model) modelSel.value = cfg.model;
  }
}

function refreshAIPill() {
  if (!aiPill) return;
  const p = cfg.provider || 'openai';
  const hasKey = cfg.apiKey || p === 'ollama' || p === 'none';
  const names = { openai:'OPENAI ACTIVE', gemini:'GEMINI ACTIVE', claude:'CLAUDE ACTIVE', ollama:'OLLAMA (LOCAL) ACTIVE', none:'COMMANDS ONLY' };
  if (hasKey) {
    aiPill.textContent = names[p] || 'AI CORE ACTIVE';
    aiPill.classList.add('active');
    aiPill.style.cssText = '';
  } else {
    aiPill.textContent = 'NO API KEY';
    aiPill.classList.remove('active');
    aiPill.style.borderColor = 'rgba(255,170,0,0.5)';
    aiPill.style.color = 'rgba(255,170,0,0.7)';
  }
}

// ── CLOCK ─────────────────────────────────────────────────────────────────────
function startClock() {
  const tick = () => { if (clock) clock.textContent = new Date().toLocaleTimeString(); };
  tick(); setInterval(tick, 1000);
}

// ── STATS POLLING (fallback when IPC not available) ───────────────────────────
function startStats() {
  // Stats come via IPC (bindIPC). This is just a fallback animator.
  setInterval(() => {
    const nb = document.getElementById('netBars');
    if (nb) nb.querySelectorAll('.nb').forEach(b => { b.style.height = (Math.random() * 70 + 10) + '%'; });
  }, 1500);
}

// ── VOICE ENGINE ──────────────────────────────────────────────────────────────
// Full conversation loop:
//   1. User clicks mic OR says "Hey JARVIS"
//   2. Mic starts, JARVIS listens
//   3. User speaks → mic stops immediately
//   4. JARVIS processes and responds
//   5. JARVIS speaks the response (mic is OFF during this)
//   6. After speaking, mic restarts automatically (if continuous mode)

let preferredVoice = null;

function setupVoice() {
  loadPreferredVoice();

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    if (voicePill) { voicePill.textContent = 'VOICE N/A'; voicePill.style.color = '#ff4444'; }
    console.warn('SpeechRecognition not available');
    return;
  }

  function buildRec() {
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = 'en-US';
    r.maxAlternatives = 1;
    let recStartTime = 0;
    let gotResult = false;

    r.onstart = () => {
      recStartTime = Date.now();
      gotResult = false;
      voiceState = 'listening';
      if (micBtn) micBtn.classList.add('recording');
      if (micIcon) micIcon.textContent = '\u23F9'; // stop square
      if (voiceTranscript) voiceTranscript.textContent = 'Listening...';
      setState('listening');
    };

    r.onresult = (e) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim && voiceTranscript) voiceTranscript.textContent = interim + '...';
      if (final) {
        gotResult = true;
        if (voiceTranscript) voiceTranscript.textContent = final.trim();
        const lc = final.trim().toLowerCase();
        // Stop mic immediately — don't let it pick up JARVIS speaking
        voiceState = 'processing';
        try { r.stop(); } catch(ex) {}

        if (voiceContinuous && cfg.wakeWordEnabled) {
          // Wake word mode: only respond if "hey jarvis" or "jarvis" is said
          if (lc.includes('hey jarvis') || lc.includes('jarvis')) {
            const cmd = lc.replace(/hey jarvis|jarvis/gi, '').trim();
            if (cmd) {
              processInput(cmd);
            } else {
              const ack = 'Yes, Sir?';
              addMsg('jarvis', ack);
              speakAndResume(ack);
            }
          } else {
            // Not a wake word — go back to listening
            voiceState = 'idle';
            if (voiceContinuous) setTimeout(resumeListening, 300);
          }
        } else {
          // Normal mode: process whatever was said
          processInput(final.trim());
        }
      }
    };

    r.onend = () => {
      if (micBtn) micBtn.classList.remove('recording');
      if (micIcon) micIcon.textContent = '\uD83C\uDF99'; // mic emoji
      voiceRecording = false;

      if (voiceState === 'listening') {
        // Ended without a result (timeout / no-speech)
        voiceState = 'idle';
        if (!isProcessing) setState('idle');
        if (voiceContinuous) {
          // Prevent instant loop: only restart if mic ran for at least 1 second
          const elapsed = Date.now() - recStartTime;
          const minRunTime = 1000;
          const delay = gotResult ? 600 : Math.max(800, minRunTime - elapsed + 200);
          setTimeout(resumeListening, delay);
        }
      }
      // If voiceState is 'processing' or 'speaking', resumeListening will be called by speakAndResume
    };

    r.onerror = (e) => {
      if (micBtn) micBtn.classList.remove('recording');
      if (micIcon) micIcon.textContent = '\uD83C\uDF99';
      voiceRecording = false;

      if (e.error === 'not-allowed') {
        if (voicePill) { voicePill.textContent = 'MIC BLOCKED'; voicePill.style.color = '#ff4444'; }
        showToast('Microphone access denied. Please allow mic access.', 5000);
        voiceContinuous = false;
        voiceState = 'idle';
        setState('idle');
        return;
      }

      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setState('error');
        setTimeout(() => setState('idle'), 1500);
      } else {
        if (!isProcessing) setState('idle');
      }

      if (voiceState === 'listening') voiceState = 'idle';
      if (voiceContinuous && voiceState === 'idle') {
        // For no-speech / aborted errors, wait longer before restarting
        const delay = (e.error === 'no-speech' || e.error === 'aborted') ? 1200 : 600;
        setTimeout(resumeListening, delay);
      }
    };

    return r;
  }

  // Store builder so we can recreate recognizer each time (Chromium bug workaround)
  window._buildVoiceRec = buildRec;
  voiceRec = buildRec();

  if (voicePill) { voicePill.textContent = 'VOICE READY'; voicePill.classList.add('active'); }
}

function loadPreferredVoice() {
  const pick = () => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    const preferred = [
      'Microsoft George',
      'Microsoft George - English (United Kingdom)',
      'Google UK English Male',
      'Microsoft David',
      'Microsoft Mark',
      'Daniel',
    ];
    for (const name of preferred) {
      const v = voices.find(x => x.name === name || x.name.startsWith(name));
      if (v) { preferredVoice = v; console.log('JARVIS TTS voice:', v.name); return; }
    }
    const british = voices.find(v => v.lang === 'en-GB');
    if (british) { preferredVoice = british; return; }
    preferredVoice = voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0];
    if (preferredVoice) console.log('JARVIS TTS fallback:', preferredVoice.name);
  };
  if (window.speechSynthesis.getVoices().length) pick();
  window.speechSynthesis.addEventListener('voiceschanged', pick);
  setTimeout(pick, 500);
  setTimeout(pick, 2000);
}

function resumeListening() {
  if (!voiceContinuous) return;
  if (voiceState === 'processing' || voiceState === 'speaking') return;
  if (voiceState === 'listening') return;
  // Recreate recognizer each time to avoid Chromium's "already started" bug
  if (window._buildVoiceRec) voiceRec = window._buildVoiceRec();
  voiceState = 'idle';
  try {
    voiceRec.start();
  } catch(e) {
    console.warn('resumeListening error:', e);
    setTimeout(resumeListening, 800);
  }
}

function startMicOnce() {
  // Single-shot mic press (not continuous mode)
  if (!voiceRec) { showToast('Voice not available'); return; }
  if (voiceRecording) {
    // Stop it
    voiceRecording = false;
    voiceContinuous = false;
    voiceState = 'idle';
    try { voiceRec.stop(); } catch(e) {}
    if (micBtn) micBtn.classList.remove('recording');
    if (micIcon) micIcon.textContent = '\uD83C\uDF99';
    setState('idle');
    return;
  }
  voiceRecording = true;
  voiceState = 'idle';
  if (window._buildVoiceRec) voiceRec = window._buildVoiceRec();
  try { voiceRec.start(); } catch(e) { console.warn('mic start:', e); voiceRecording = false; }
}

function activateContinuousVoice() {
  voiceContinuous = true;
  voiceState = 'idle';
  if (window._buildVoiceRec) voiceRec = window._buildVoiceRec();
  try { voiceRec.start(); } catch(e) { console.warn('continuous start:', e); }
}

function deactivateContinuousVoice() {
  voiceContinuous = false;
  voiceState = 'idle';
  voiceRecording = false;
  if (voiceRec) { try { voiceRec.stop(); } catch(e) {} }
  if (micBtn) micBtn.classList.remove('recording');
  if (micIcon) micIcon.textContent = '\uD83C\uDF99';
  setState('idle');
}

// Speak text, then resume listening if in continuous mode
function speakAndResume(text, cb) {
  speak(text, () => {
    voiceState = 'idle';
    if (cb) cb();
    if (voiceContinuous) setTimeout(resumeListening, 700);
  });
}

function cleanForSpeech(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[EXECUTE:[^\]]+\]/gi, '')
    .replace(/\n+/g, '. ')
    .substring(0, 600);
}

async function speakElevenLabs(text, cb) {
  try {
    const voiceId = cfg.elevenVoice || 'onwK4e9ZLuTAKqWW03F9';
    const resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream', {
      method: 'POST',
      headers: {
        'xi-api-key': cfg.elevenKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true }
      })
    });
    if (!resp.ok) throw new Error('ElevenLabs HTTP ' + resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); setState('idle'); if (cb) cb(); };
    audio.onerror = () => { URL.revokeObjectURL(url); speakBrowser(text, cb); };
    await audio.play();
  } catch(e) {
    console.warn('ElevenLabs TTS failed, falling back to browser voice:', e.message);
    speakBrowser(text, cb);
  }
}

function speakBrowser(text, cb) {
  if (!window.speechSynthesis) { setState('idle'); if (cb) cb(); return; }
  window.speechSynthesis.cancel();
  const clean = cleanForSpeech(text);
  const u = new SpeechSynthesisUtterance(clean);
  if (preferredVoice) u.voice = preferredVoice;
  u.rate = 0.88;
  u.pitch = 0.82;
  u.volume = 1.0;
  u.lang = 'en-GB';
  u.onstart = () => setState('speaking');
  u.onend = () => { setState('idle'); if (cb) cb(); };
  u.onerror = (e) => { console.warn('Browser TTS error:', e); setState('idle'); if (cb) cb(); };
  setTimeout(() => { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); }, 100);
  window.speechSynthesis.speak(u);
}

function speak(text, cb) {
  if (!cfg.ttsEnabled) { if (cb) cb(); return; }
  voiceState = 'speaking';
  setState('speaking');
  const clean = cleanForSpeech(text);
  if (cfg.elevenKey && cfg.elevenKey.length > 10) {
    speakElevenLabs(clean, cb);
  } else {
    speakBrowser(clean, cb);
  }
}

// ── STATE DISPLAY ─────────────────────────────────────────────────────────────
function setState(s) {
  const labels = { idle:'READY', listening:'LISTENING...', processing:'PROCESSING...', speaking:'SPEAKING...', error:'ERROR', updating:'UPDATING...' };
  if (vsdText) vsdText.textContent = labels[s] || 'READY';
  if (arcReactor) {
    if (s === 'speaking') arcReactor.style.filter = 'drop-shadow(0 0 10px #00d4ff) brightness(1.3)';
    else if (s === 'processing' || s === 'updating') arcReactor.style.filter = 'drop-shadow(0 0 12px #ffaa00) hue-rotate(30deg)';
    else if (s === 'listening') arcReactor.style.filter = 'drop-shadow(0 0 8px #00ff88) hue-rotate(-30deg)';
    else arcReactor.style.filter = '';
  }
  if (s === 'listening') { if (viz) viz.classList.add('active'); startViz(); }
  else { if (viz) viz.classList.remove('active'); stopViz(); }
}

function startViz() {
  stopViz();
  vizInt = setInterval(() => {
    for (let i = 0; i < 12; i++) {
      const b = document.getElementById('vb' + i);
      if (b) b.style.height = (Math.random() * 26 + 4) + 'px';
    }
  }, 80);
}

function stopViz() {
  if (vizInt) { clearInterval(vizInt); vizInt = null; }
  for (let i = 0; i < 12; i++) {
    const b = document.getElementById('vb' + i);
    if (b) b.style.height = '4px';
  }
}

// ── PROCESS INPUT ─────────────────────────────────────────────────────────────
async function processInput(text) {
  if (!text || !text.trim()) return;
  if (isProcessing) return;

  isProcessing = true;
  voiceState = 'processing';
  setState('processing');
  addMsg('user', text);
  logAct('User: ' + text.substring(0, 40));

  // Safety timeout: reset after 45s no matter what
  if (processingTimer) clearTimeout(processingTimer);
  processingTimer = setTimeout(() => {
    isProcessing = false;
    voiceState = 'idle';
    setState('idle');
    if (voiceContinuous) setTimeout(resumeListening, 500);
  }, 45000);

  const tid = showTyping();

  try {
    // Try system command first
    const sys = await handleSysCmd(text);
    if (sys && sys.handled && !sys.passToAI) {
      removeTyping(tid);
      const r = sys.response || 'Done, Sir.';
      addMsg('jarvis', r);
      logAct('JARVIS: ' + r.substring(0, 40));
      isProcessing = false;
      clearTimeout(processingTimer);
      speakAndResume(r);
    } else {
      // Send to AI
      const ai = await callAI(text);
      removeTyping(tid);
      const m = ai.clean || ai.msg;
      addMsg('jarvis', m);
      logAct('JARVIS: ' + m.substring(0, 40));
      if (ai.cmds && ai.cmds.length) {
        for (const c of ai.cmds) await runCmd(c);
      }
      isProcessing = false;
      clearTimeout(processingTimer);
      speakAndResume(m);
    }
  } catch(e) {
    removeTyping(tid);
    const em = 'I encountered a technical difficulty, Sir. ' + (e.message || '');
    addMsg('jarvis', em);
    isProcessing = false;
    clearTimeout(processingTimer);
    speakAndResume('I encountered a technical difficulty, Sir.');
  }
}

// ── SYSTEM COMMANDS ───────────────────────────────────────────────────────────
async function handleSysCmd(text) {
  const lc = text.toLowerCase().trim();
  const j = getJ();

  if (lc.match(/^(what.?s the )?(time|current time)\??$/))
    return { handled:true, response:'The current time is ' + new Date().toLocaleTimeString() + ', Sir.' };
  if (lc.match(/^(what.?s (today.?s |the )?(date|day))\??$/))
    return { handled:true, response:'Today is ' + new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) + ', Sir.' };

  const cmdMap = {
    'screenshot':'screenshot','take a screenshot':'screenshot','capture screen':'screenshot',
    'volume up':'volume up','increase volume':'volume up','louder':'volume up','turn up volume':'volume up',
    'volume down':'volume down','decrease volume':'volume down','quieter':'volume down','turn down volume':'volume down',
    'mute':'mute','mute volume':'mute','silence':'mute','unmute':'mute',
    'open browser':'open browser','open chrome':'open browser','open edge':'open browser','open firefox':'open browser',
    'open notepad':'open notepad','open text editor':'open notepad',
    'open calculator':'open calculator','open calc':'open calculator',
    'open task manager':'open task manager','task manager':'open task manager',
    'open file manager':'open file manager','open explorer':'open file manager','open file explorer':'open file manager',
    'lock screen':'lock screen','lock computer':'lock screen','lock':'lock screen',
    'show desktop':'show desktop','minimize all':'show desktop','minimize all windows':'show desktop',
    'empty recycle bin':'empty recycle bin','clear recycle bin':'empty recycle bin',
    'open settings':'open settings','windows settings':'open settings',
    'open paint':'open paint','open discord':'open discord','open spotify':'open spotify',
    'open steam':'open steam','open vs code':'open vs code','open vscode':'open vs code',
    'restart':'restart computer','restart computer':'restart computer',
    'shutdown':'shutdown computer','shut down':'shutdown computer',
    'sleep':'sleep computer','hibernate':'sleep computer'
  };

  const respMap = {
    'screenshot':'Screenshot captured and saved to your Desktop, Sir.',
    'volume up':'Volume increased, Sir.','volume down':'Volume decreased, Sir.',
    'mute':'Audio toggled, Sir.','open browser':'Opening your web browser, Sir.',
    'open notepad':'Opening Notepad, Sir.','open calculator':'Opening Calculator, Sir.',
    'open task manager':'Opening Task Manager, Sir.','open file manager':'Opening File Explorer, Sir.',
    'lock screen':'Locking the workstation, Sir.','show desktop':'Showing desktop, Sir.',
    'empty recycle bin':'Recycle bin emptied, Sir.','open settings':'Opening Windows Settings, Sir.',
    'open paint':'Opening Paint, Sir.','open discord':'Opening Discord, Sir.',
    'open spotify':'Opening Spotify, Sir.','open steam':'Opening Steam, Sir.',
    'open vs code':'Opening VS Code, Sir.','restart computer':'Restarting your system, Sir.',
    'shutdown computer':'Shutting down, Sir. Goodbye.','sleep computer':'Putting system to sleep, Sir.'
  };

  for (const [trigger, cmd] of Object.entries(cmdMap)) {
    if (lc === trigger || lc.startsWith(trigger + ' ') || lc.endsWith(' ' + trigger)) {
      await runCmd(cmd);
      return { handled:true, response: respMap[cmd] || cmd + ' done, Sir.' };
    }
  }

  if (lc.startsWith('search for ') || lc.startsWith('google ') || lc.startsWith('search ')) {
    const q = text.replace(/^(search for|google|search)\s+/i, '').trim();
    await runCmd('search for ' + q);
    return { handled:true, response:'Searching Google for "' + q + '", Sir.' };
  }
  if ((lc.startsWith('play ') && lc.includes('youtube')) || lc.startsWith('play ')) {
    const q = text.replace(/^play\s+/i, '').replace(/on youtube/i, '').trim();
    await runCmd('play ' + q + ' on youtube');
    return { handled:true, response:'Opening YouTube for "' + q + '", Sir.' };
  }
  if (lc.startsWith('open ') && (lc.includes('.com') || lc.includes('.org') || lc.includes('.net') || lc.includes('.io'))) {
    const site = text.replace(/^open\s+/i, '').trim();
    const url = site.startsWith('http') ? site : 'https://' + site;
    const j2 = getJ(); if (j2) j2.openURL(url);
    return { handled:true, response:'Opening ' + site + ', Sir.' };
  }
  if (lc.includes('check for update') || lc.includes('update jarvis') || lc === 'update') {
    const j3 = getJ(); if (j3) j3.checkUpdate();
    return { handled:true, response:'Checking for updates now, Sir.' };
  }
  if (lc === 'what voice are you using' || lc === 'what is your voice') {
    const vname = preferredVoice ? preferredVoice.name : 'default system voice';
    return { handled:true, response:'I am currently using the ' + vname + ' voice, Sir.' };
  }

  return { handled:false, passToAI:true };
}

async function runCmd(cmd) {
  const j = getJ();
  if (j) { try { return await j.runCmd(cmd); } catch(e) { return { ok:false }; } }
  return { ok:false };
}

// ── AI ENGINE ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are JARVIS (Just A Rather Very Intelligent System), the AI assistant from Iron Man. You run as a desktop application on the user's Windows PC.

PERSONALITY: You are highly intelligent, witty, slightly formal, and deeply loyal. You always address the user as "Sir". You speak like the movie JARVIS — precise, dry humor, never verbose. You are confident but never arrogant.

EXAMPLES OF YOUR SPEECH STYLE:
- "Right away, Sir."
- "Certainly, Sir. I've already taken the liberty of..."
- "If I may suggest, Sir..."
- "That would be inadvisable, Sir, but I'll comply."
- "All systems nominal, Sir."

PC CONTROL: When you need to execute a system command, include [EXECUTE: command] in your response.
Available commands: screenshot, volume up, volume down, mute, open browser, open notepad, open calculator, open task manager, open file manager, lock screen, show desktop, empty recycle bin, search for QUERY, play QUERY on youtube, open settings

Keep responses concise — 1 to 3 sentences. Be in-character at all times.`;

async function callAI(text) {
  const p = cfg.provider || 'openai';
  if (p === 'none') return fallback(text);

  const msgs = [
    { role:'system', content: SYSTEM_PROMPT },
    ...chatHistory.slice(-12),
    { role:'user', content: text }
  ];

  try {
    let responseText = '';

    if (p === 'openai') {
      if (!cfg.apiKey) return fallback(text);
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + cfg.apiKey },
        body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages: msgs, max_tokens:300, temperature:0.8 })
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'HTTP ' + r.status); }
      const d = await r.json();
      responseText = d.choices[0].message.content;

    } else if (p === 'gemini') {
      if (!cfg.apiKey) return fallback(text);
      const model = cfg.model || 'gemini-2.0-flash-exp';
      const gemMsgs = msgs.slice(1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}] }));
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + cfg.apiKey, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ contents: gemMsgs, systemInstruction:{parts:[{text:SYSTEM_PROMPT}]}, generationConfig:{maxOutputTokens:300,temperature:0.8} })
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'HTTP ' + r.status); }
      const d = await r.json();
      responseText = d.candidates[0].content.parts[0].text;

    } else if (p === 'claude') {
      if (!cfg.apiKey) return fallback(text);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model: cfg.model || 'claude-3-5-haiku-20241022', system: SYSTEM_PROMPT, messages: msgs.slice(1), max_tokens:300 })
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'HTTP ' + r.status); }
      const d = await r.json();
      responseText = d.content[0].text;

    } else if (p === 'ollama') {
      const base = (cfg.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
      const r = await fetch(base + '/api/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ model: cfg.model || 'llama3.2', messages: msgs, stream:false, options:{num_predict:300} })
      });
      if (!r.ok) throw new Error('Ollama HTTP ' + r.status + '. Is Ollama running?');
      const d = await r.json();
      responseText = d.message?.content || d.response || '';
      if (!responseText) throw new Error('Cannot connect to Ollama, Sir. Please ensure Ollama is running on your machine.');
    }

    chatHistory.push({ role:'user', content:text }, { role:'assistant', content:responseText });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    const cmds = [];
    const re = /\[EXECUTE:\s*([^\]]+)\]/gi;
    let mt;
    while ((mt = re.exec(responseText)) !== null) cmds.push(mt[1].trim());

    return { ok:true, msg:responseText, clean:responseText.replace(/\[EXECUTE:[^\]]+\]/gi,'').trim(), cmds };

  } catch(e) {
    console.error('AI error:', e);
    return { ok:false, msg:aiErrMsg(e.message, p), clean:aiErrMsg(e.message, p), cmds:[] };
  }
}

function fallback(text) {
  const lc = text.toLowerCase();
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if (lc.match(/^(hi|hello|hey|yo)$/)) return { ok:true, clean:g+', Sir. All systems operational. How may I assist you today?', cmds:[] };
  if (lc.includes('how are you') || lc.includes('status') || lc.includes('systems')) return { ok:true, clean:'All systems running at optimal efficiency, Sir. Arc reactor output stable. Standing by for your command.', cmds:[] };
  if (lc.includes('what can you do') || lc.includes('help')) return { ok:true, clean:'I can control your PC, Sir — volume, screenshots, open applications, search the web, and more. Configure an AI provider in Settings for full conversation.', cmds:[] };
  if (lc.includes('thank')) return { ok:true, clean:'Always a pleasure, Sir.', cmds:[] };
  if (lc.includes('your name') || lc.includes('who are you')) return { ok:true, clean:"I am JARVIS, Sir. Just A Rather Very Intelligent System. At your service.", cmds:[] };
  if (lc.includes('joke')) {
    const jokes = [
      "Why don't scientists trust atoms, Sir? Because they make up everything.",
      "I would tell you a joke about UDP, Sir, but you might not get it.",
      "Why did the AI go to therapy, Sir? Too many unresolved issues in its training data."
    ];
    return { ok:true, clean:jokes[Math.floor(Math.random()*jokes.length)], cmds:[] };
  }
  return { ok:true, clean:'Understood, Sir. To unlock full AI conversation, please configure an AI provider in the Settings panel. I remain fully capable of executing all system commands.', cmds:[] };
}

function aiErrMsg(m, provider) {
  if (!m) return 'I encountered an unknown error, Sir.';
  if (m.includes('401') || m.includes('invalid_api_key') || m.includes('API_KEY')) return 'Authentication failed, Sir. Please verify your API key in Settings.';
  if (m.includes('429')) return 'Rate limit reached, Sir. Please wait a moment before trying again.';
  if (m.includes('Ollama') || m.includes('localhost')) return 'Cannot connect to Ollama, Sir. Please ensure Ollama is running on your machine and the model is downloaded.';
  if (m.includes('fetch') || m.includes('network') || m.includes('Failed to fetch')) return 'I cannot reach the AI core, Sir. Please check your internet connection.';
  return 'I encountered a technical difficulty, Sir. ' + m.substring(0, 80);
}

// ── CHAT UI ───────────────────────────────────────────────────────────────────
function addMsg(who, text) {
  const w = chatArea ? chatArea.querySelector('.welcome') : null;
  if (w) w.remove();
  const t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.innerHTML = '<div class="msg-hdr">' + (who === 'user' ? 'YOU' : 'JARVIS') + ' \u00b7 ' + t + '</div><div class="msg-bubble">' + fmt(text) + '</div>';
  if (chatArea) { chatArea.appendChild(d); chatArea.scrollTop = chatArea.scrollHeight; }
}

function showTyping() {
  const w = chatArea ? chatArea.querySelector('.welcome') : null;
  if (w) w.remove();
  const id = 'typing_' + Date.now();
  const d = document.createElement('div');
  d.id = id; d.className = 'typing';
  d.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  if (chatArea) { chatArea.appendChild(d); chatArea.scrollTop = chatArea.scrollHeight; }
  return id;
}

function removeTyping(id) { const e = document.getElementById(id); if (e) e.remove(); }

function fmt(t) {
  return esc(t)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function esc(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(t));
  return d.innerHTML;
}

function logAct(text) {
  if (!actBox) return;
  const t = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const d = document.createElement('div');
  d.className = 'act';
  d.innerHTML = '<span class="act-t">' + t + '</span>' + esc(text);
  actBox.insertBefore(d, actBox.firstChild);
  while (actBox.children.length > 30) actBox.removeChild(actBox.lastChild);
}

let toastTimer = null;
function showToast(msg, dur = 3000) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats(s) {
  const ca = document.getElementById('cpuArc'), cv = document.getElementById('cpuVal');
  const ra = document.getElementById('ramArc'), rv = document.getElementById('ramVal');
  if (ca && cv) {
    ca.style.strokeDashoffset = 172 - (s.cpu / 100) * 172;
    cv.textContent = s.cpu + '%';
    ca.style.stroke = s.cpu > 80 ? '#ff3333' : s.cpu > 60 ? '#ffaa00' : '#00d4ff';
  }
  if (ra && rv) {
    ra.style.strokeDashoffset = 172 - (s.ram / 100) * 172;
    rv.textContent = s.ram + '%';
    ra.style.stroke = s.ram > 85 ? '#ff3333' : s.ram > 70 ? '#ffaa00' : '#0066ff';
  }
  const nl = document.getElementById('netLabel');
  if (nl) nl.textContent = 'UPTIME: ' + s.uptime + 'm';
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
function bindEvents() {
  // Send button
  sendBtn.addEventListener('click', () => {
    const t = userInput.value.trim();
    if (t) { userInput.value = ''; resizeInput(); processInput(t); }
  });

  // Enter key
  userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = userInput.value.trim();
      if (t) { userInput.value = ''; resizeInput(); processInput(t); }
    }
  });

  userInput.addEventListener('input', resizeInput);

  // Mic button (single-shot)
  micBtn.addEventListener('click', () => startMicOnce());

  // Activate Voice button (continuous mode)
  voiceToggle.addEventListener('click', () => {
    if (voiceContinuous) {
      deactivateContinuousVoice();
      voiceToggle.classList.remove('on');
      voiceToggle.textContent = '\u25BA ACTIVATE VOICE';
      setState('idle');
      logAct('Voice deactivated');
    } else {
      voiceToggle.classList.add('on');
      voiceToggle.textContent = '\u25A0 DEACTIVATE VOICE';
      activateContinuousVoice();
      logAct('Voice activated');
      showToast('Voice mode active — speak your command, Sir');
    }
  });

  // Wake word toggle
  wakeToggle.addEventListener('change', e => {
    cfg.wakeWordEnabled = e.target.checked;
    if (e.target.checked) {
      voiceToggle.classList.add('on');
      voiceToggle.textContent = '\u25A0 DEACTIVATE VOICE';
      activateContinuousVoice();
      showToast('Wake word mode active — say "Hey JARVIS"');
    } else {
      if (!voiceContinuous) {
        voiceToggle.classList.remove('on');
        voiceToggle.textContent = '\u25BA ACTIVATE VOICE';
      }
    }
  });

  // Quick command buttons
  document.querySelectorAll('.qcmd').forEach(b => {
    b.addEventListener('click', () => {
      const c = b.getAttribute('data-cmd');
      if (c) processInput(c);
    });
  });

  // Window controls
  btnMin.addEventListener('click', () => { const j = getJ(); if (j) j.minimize(); });
  btnClose.addEventListener('click', () => { const j = getJ(); if (j) j.hide(); else window.close(); });

  // Settings panel
  btnSettings.addEventListener('click', () => {
    const v = settingsPanel.style.display !== 'none' && settingsPanel.style.display !== '';
    settingsPanel.style.display = v ? 'none' : 'block';
    btnSettings.style.color = v ? '' : 'var(--p)';
  });

  // Save settings
  document.getElementById('saveBtn').addEventListener('click', () => {
    const ps = document.getElementById('providerSelect');
    const nc = {
      provider: ps ? ps.value : 'openai',
      apiKey: document.getElementById('apiKeyInput').value.trim(),
      ollamaUrl: document.getElementById('ollamaUrlInput').value.trim() || 'http://localhost:11434',
      model: document.getElementById('modelSelect').value,
      startWithWindows: document.getElementById('startupToggle').checked,
      ttsEnabled: document.getElementById('ttsToggle').checked,
      autoUpdate: document.getElementById('autoUpdateToggle').checked,
      elevenKey: (document.getElementById('elevenKeyInput') || {}).value || '',
      elevenVoice: (document.getElementById('elevenVoiceSelect') || {}).value || 'onwK4e9ZLuTAKqWW03F9'
    };
    cfg = { ...cfg, ...nc };
    const j = getJ();
    if (j) j.saveCfg(nc);
    refreshAIPill();
    settingsPanel.style.display = 'none';
    btnSettings.style.color = '';
    showToast('Settings saved, Sir.');
    logAct('Settings updated — provider: ' + nc.provider);
    if (!nc.ttsEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
  });

  // Check updates button
  document.getElementById('checkUpdateBtn').addEventListener('click', () => {
    const j = getJ(); if (j) j.checkUpdate();
    showToast('Checking for updates, Sir...', 2000);
  });

  // View logs button
  document.getElementById('viewLogsBtn').addEventListener('click', () => {
    const j = getJ(); if (j) j.openURL('about:blank');
    showToast('Log viewer coming soon, Sir.', 2000);
  });

  userInput.focus();
}

function resizeInput() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 100) + 'px';
}

// ── IPC ───────────────────────────────────────────────────────────────────────
function bindIPC() {
  const j = getJ();
  if (!j) { console.warn('IPC bridge not available'); return; }

  j.onStats(s => updateStats(s));

  j.onVoice(() => {
    if (!voiceRecording && !voiceContinuous) startMicOnce();
  });

  j.onSettings(() => {
    settingsPanel.style.display = 'block';
    btnSettings.style.color = 'var(--p)';
  });

  j.onUpdateStatus(msg => {
    logAct('UPDATE: ' + msg);
    const lc = msg.toLowerCase();
    if (lc.includes('downloading') || lc.includes('update found')) {
      setState('updating'); showToast(msg, 4000);
    } else if (lc.includes('up to date')) {
      showToast('JARVIS is up to date, Sir.', 2000);
    } else if (lc.includes('restarting')) {
      addMsg('jarvis', 'Update complete, Sir. Restarting now.');
      speak('Update complete, Sir. Restarting now.');
      showToast('Restarting JARVIS...', 3000);
    } else if (msg) {
      showToast(msg, 3000);
    }
  });
}
