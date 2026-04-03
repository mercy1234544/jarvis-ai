'use strict';
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
