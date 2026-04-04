# J.A.R.V.I.S.
### Just A Rather Very Intelligent System

> *"You turned on your PC, and JARVIS is already there."*

A full Iron Man-style AI desktop assistant built with Electron. Real installed Windows application.

---

## One-Click Install

1. Download **`JARVIS-Install.bat`** from this repo
2. Double-click it — that's it

The installer automatically:
- Installs **Git** if missing
- Installs **Node.js v20 LTS** if missing
- Clones this repo to `C:\Users\You\JARVIS`
- Runs `npm install`
- Creates a **Desktop shortcut** (no console window)
- Creates a **Start Menu** entry
- Launches JARVIS

---

## Features

- Arc Reactor boot animation with status updates
- Iron Man HUD with CPU/RAM gauges
- Voice control (STT + TTS) — sounds like JARVIS
- Wake word: say "Hey JARVIS"
- Full AI chat via OpenAI (GPT-4o)
- PC control: volume, screenshots, apps, web search
- System tray — minimizes, never closes (Alt+J to toggle)
- Auto-update from GitHub on every launch
- Auto-recovery if services crash

---

## PC Commands

- `screenshot`, `volume up/down`, `mute`
- `open browser/notepad/calculator/task manager/file manager`
- `lock screen`, `show desktop`, `empty recycle bin`
- `search for [query]`, `play [song] on youtube`
- `update` — check for updates manually

---

## Setup

Click Settings (gear icon) to add your OpenAI API key for full AI conversation.

---

## Manual Install

```bash
git clone https://github.com/mercy1234544/jarvis-ai.git
cd jarvis-ai
npm install
npm start
```

*Built by mercy1234544*

---

## Troubleshooting: Local AI (Ollama)

If you are using **Ollama** for local, private AI and JARVIS says "Cannot connect to Ollama", it means the Ollama background service is not running.

**How to fix it:**
1. Open your Start Menu and search for **Ollama**.
2. Click the Ollama app to start it. You should see the Ollama icon (a white llama) appear in your Windows system tray (bottom right corner near the clock).
3. Alternatively, open Command Prompt (`cmd`) and type:
   ```cmd
   ollama serve
   ```
   Leave that window open.
4. Restart JARVIS or try your command again.

**To make Ollama start automatically with Windows:**
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. Create a shortcut to the Ollama application in this folder.
3. Now Ollama will always be ready when JARVIS boots up.
