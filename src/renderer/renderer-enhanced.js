// ─────────────────────────────────────────────────────────────────────────────
// JARVIS Renderer - ENHANCED VERSION
// New Features: Web Navigation, Better Voice, Improved UI, Command History
// ─────────────────────────────────────────────────────────────────────────────

function getJ() { return window.JARVIS || null; }

// Enhanced config
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
  elevenVoice: 'onwK4e9ZLuTAKqWW03F9',
  voiceSpeed: 1.0,
  theme: 'dark'
};

// Voice state
let voiceState = 'idle';
let voiceRec = null;
let voiceContinuous = false;
let voiceRecording = false;
let _voiceActive = false;
let _voicePaused = false;

// Chat state
let chatHistory = [];
let commandHistory = [];
let historyIndex = -1;
let isProcessing = false;
let processingTimer = null;

// Viz
let vizInt = null;

// DOM REFS
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
  loadCommandHistory();

  // Greeting
  setTimeout(() => {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const msg = g + ', Sir. JARVIS is fully online. All systems nominal. How may I assist you today?';
    addMsg('jarvis', msg);
    speak(msg);
  }, 500);

  logAct('JARVIS initialized (Enhanced)');
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function applySettings() {
  const ps = document.getElementById('providerSelect');
  if (ps) { ps.value = cfg.provider || 'openai'; onProviderChange(); }
  const ak = document.getElementById('apiKeyInput');
  if (ak) ak.value = cfg.apiKey || '';
  const ok = document.getElementById('ollamaUrlInput');
  if (ok) ok.value = cfg.ollamaUrl || 'http://localhost:11434';
  const md = document.getElementById('modelSelect');
  if (md) md.value = cfg.model || 'gpt-4o-mini';
  const tt = document.getElementById('ttsToggle');
  if (tt) tt.checked = cfg.ttsEnabled;
  const sw = document.getElementById('startWithWindowsToggle');
  if (sw) sw.checked = cfg.startWithWindows;
  const au = document.getElementById('autoUpdateToggle');
  if (au) au.checked = cfg.autoUpdate;
  const ww = document.getElementById('wakeWordToggle');
  if (ww) ww.checked = cfg.wakeWordEnabled;
  const vs = document.getElementById('voiceSpeedInput');
  if (vs) vs.value = cfg.voiceSpeed;
  const ek = document.getElementById('elevenKeyInput');
  if (ek) ek.value = cfg.elevenKey || '';
}

// ── VOICE SETUP ──────────────────────────────────────────────────────────────
function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    logAct('Speech Recognition not available');
    return;
  }

  voiceRec = new SpeechRecognition();
  voiceRec.continuous = true;
  voiceRec.interimResults = true;
  voiceRec.lang = 'en-US';

  voiceRec.onstart = () => {
    voiceState = 'listening';
    if (voiceToggle) voiceToggle.classList.add('on');
    if (viz) viz.classList.add('active');
    logAct('Voice listening started');
  };

  voiceRec.onresult = (event) => {
    if (_voicePaused) return;

    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += text + ' ';
      } else {
        interim += text;
      }
    }

    if (voiceTranscript) {
      voiceTranscript.textContent = interim || final;
    }

    if (final.trim()) {
      processVoiceCommand(final.trim());
    }
  };

  voiceRec.onerror = (event) => {
    logAct('Voice error: ' + event.error);
    if (voicePill) voicePill.textContent = 'VOICE ERROR';
  };

  voiceRec.onend = () => {
    voiceState = 'idle';
    if (_voiceActive) {
      voiceRec.start();
    } else {
      if (voiceToggle) voiceToggle.classList.remove('on');
      if (viz) viz.classList.remove('active');
    }
  };
}

function processVoiceCommand(text) {
  if (!text.trim()) return;

  voiceState = 'processing';
  _voicePaused = true;

  // Check for wake word
  const wakeWords = ['hey jarvis', 'jarvis', 'hey', 'javis', 'garvis', 'service'];
  let command = text.toLowerCase();
  let foundWake = false;

  for (const wake of wakeWords) {
    if (command.includes(wake)) {
      command = command.replace(wake, '').trim();
      foundWake = true;
      break;
    }
  }

  if (cfg.wakeWordEnabled && !foundWake) {
    _voicePaused = false;
    return;
  }

  if (command.trim()) {
    userInput.value = command;
    sendMessage();
  } else if (foundWake) {
    const response = 'Yes, Sir?';
    addMsg('jarvis', response);
    speak(response);
    _voicePaused = false;
  }
}

function activateContinuousVoice() {
  _voiceActive = true;
  _voicePaused = false;
  if (voiceRec && voiceState !== 'listening') {
    voiceRec.start();
  }
  logAct('Continuous voice activated');
}

function deactivateContinuousVoice() {
  _voiceActive = false;
  if (voiceRec) {
    voiceRec.abort();
  }
  logAct('Continuous voice deactivated');
}

// ── COMMAND HISTORY ──────────────────────────────────────────────────────────
function loadCommandHistory() {
  const j = getJ();
  if (j) {
    j.getHistory().then(h => {
      commandHistory = h || [];
      historyIndex = -1;
    }).catch(() => {});
  }
}

function addToHistory(cmd) {
  commandHistory.push(cmd);
  historyIndex = -1;
  const j = getJ();
  if (j) {
    j.saveHistory(commandHistory).catch(() => {});
  }
}

// ── SEND MESSAGE ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const msg = userInput.value.trim();
  if (!msg || isProcessing) return;

  addToHistory(msg);
  addMsg('user', msg);
  userInput.value = '';
  voiceTranscript.textContent = '';
  isProcessing = true;
  voiceState = 'processing';

  if (sendBtn) sendBtn.disabled = true;

  try {
    // Check for web navigation
    if (isWebCommand(msg)) {
      handleWebNavigation(msg);
      isProcessing = false;
      voiceState = 'idle';
      if (sendBtn) sendBtn.disabled = false;
      _voicePaused = false;
      return;
    }

    const j = getJ();
    if (!j) throw new Error('IPC bridge not available');

    const response = await j.askAI(msg);
    addMsg('jarvis', response);
    speak(response);

    logAct('Response generated');
  } catch (error) {
    const errMsg = 'I encountered an error processing your request, Sir.';
    addMsg('jarvis', errMsg);
    speak(errMsg);
    logAct('Error: ' + error.message);
  } finally {
    isProcessing = false;
    voiceState = 'idle';
    if (sendBtn) sendBtn.disabled = false;
    _voicePaused = false;
  }
}

// ── WEB NAVIGATION ───────────────────────────────────────────────────────────
function isWebCommand(text) {
  const lower = text.toLowerCase();
  return lower.includes('open') || lower.includes('go to') || lower.includes('visit') || lower.includes('website');
}

function handleWebNavigation(text) {
  const lower = text.toLowerCase();
  let site = '';

  // Extract site name
  const patterns = [
    /open\s+(?:the\s+)?(.+?)(?:\s+website)?$/i,
    /go\s+to\s+(?:the\s+)?(.+?)$/i,
    /visit\s+(?:the\s+)?(.+?)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      site = match[1].trim();
      break;
    }
  }

  if (!site) {
    addMsg('jarvis', 'I\'m not sure which website you\'d like to visit, Sir.');
    return;
  }

  const j = getJ();
  if (j) {
    j.openWebsite(site).then(() => {
      addMsg('jarvis', `Opening ${site} for you, Sir.`);
      speak(`Opening ${site} for you, Sir.`);
    }).catch(err => {
      addMsg('jarvis', `I couldn't open ${site}, Sir.`);
      logAct('Web nav error: ' + err);
    });
  }
}

// ── SPEAK ────────────────────────────────────────────────────────────────────
function speak(text) {
  if (!cfg.ttsEnabled) return;

  _voicePaused = true;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = cfg.voiceSpeed || 1.0;

  utterance.onend = () => {
    _voicePaused = false;
    if (_voiceActive && voiceRec) {
      voiceRec.start();
    }
  };

  utterance.onerror = () => {
    _voicePaused = false;
  };

  window.speechSynthesis.speak(utterance);
}

// ── CHAT MESSAGES ────────────────────────────────────────────────────────────
function addMsg(role, text) {
  const msg = { role, text, time: new Date() };
  chatHistory.push(msg);

  const msgEl = document.createElement('div');
  msgEl.className = `msg ${role}`;

  const hdr = document.createElement('div');
  hdr.className = 'msg-hdr';
  hdr.textContent = role === 'user' ? 'YOU' : 'JARVIS';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  msgEl.appendChild(hdr);
  msgEl.appendChild(bubble);
  chatArea.appendChild(msgEl);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ── EVENTS ───────────────────────────────────────────────────────────────────
function bindEvents() {
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (userInput) {
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    // Command history navigation
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          userInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          userInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
        } else if (historyIndex === 0) {
          historyIndex = -1;
          userInput.value = '';
        }
      }
    });
  }

  if (voiceToggle) {
    voiceToggle.addEventListener('click', () => {
      if (_voiceActive) {
        deactivateContinuousVoice();
      } else {
        activateContinuousVoice();
      }
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      if (settingsPanel) {
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  if (btnMin) {
    btnMin.addEventListener('click', () => {
      const j = getJ();
      if (j) j.minimize();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      const j = getJ();
      if (j) j.hide();
    });
  }
}

function bindIPC() {
  const j = getJ();
  if (!j) return;

  j.onVoiceTrigger(() => {
    if (_voiceActive) {
      deactivateContinuousVoice();
    } else {
      activateContinuousVoice();
    }
  });
}

// ── CLOCK ────────────────────────────────────────────────────────────────────
function startClock() {
  function update() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    if (clock) clock.textContent = time;
  }
  update();
  setInterval(update, 1000);
}

// ── STATS ────────────────────────────────────────────────────────────────────
function startStats() {
  // Placeholder for system stats
  setInterval(() => {
    // Update gauges, network bars, etc.
  }, 1000);
}

// ── ACTIVITY LOG ─────────────────────────────────────────────────────────────
function logAct(msg) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const act = document.createElement('div');
  act.className = 'act';
  act.innerHTML = `<span class="act-t">[${time}]</span> ${msg}`;
  if (actBox) {
    actBox.appendChild(act);
    actBox.scrollTop = actBox.scrollHeight;
    // Keep only last 100 logs
    while (actBox.children.length > 100) {
      actBox.removeChild(actBox.firstChild);
    }
  }
}

// ── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  if (toastEl) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 3000);
  }
}

// ── SETTINGS SAVE ────────────────────────────────────────────────────────────
async function saveSettings() {
  const ps = document.getElementById('providerSelect');
  const ak = document.getElementById('apiKeyInput');
  const ok = document.getElementById('ollamaUrlInput');
  const md = document.getElementById('modelSelect');
  const tt = document.getElementById('ttsToggle');
  const sw = document.getElementById('startWithWindowsToggle');
  const au = document.getElementById('autoUpdateToggle');
  const ww = document.getElementById('wakeWordToggle');
  const vs = document.getElementById('voiceSpeedInput');
  const ek = document.getElementById('elevenKeyInput');

  cfg = {
    provider: ps?.value || 'openai',
    apiKey: ak?.value || '',
    ollamaUrl: ok?.value || 'http://localhost:11434',
    model: md?.value || 'gpt-4o-mini',
    ttsEnabled: tt?.checked || true,
    startWithWindows: sw?.checked || false,
    autoUpdate: au?.checked || true,
    wakeWordEnabled: ww?.checked || false,
    voiceSpeed: parseFloat(vs?.value) || 1.0,
    elevenKey: ek?.value || ''
  };

  const j = getJ();
  if (j) {
    try {
      await j.saveCfg(cfg);
      showToast('Settings saved, Sir.');
      logAct('Settings saved');
    } catch (error) {
      showToast('Failed to save settings.');
      logAct('Settings save error: ' + error);
    }
  }
}

// Export for HTML
window.saveSettings = saveSettings;
window.onProviderChange = () => {}; // Placeholder
