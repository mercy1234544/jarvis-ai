# J.A.R.V.I.S.
### Just A Rather Very Intelligent System

> *"You turned on your PC, and JARVIS is already there."*

A full Iron Man-style AI desktop assistant built with Electron. Real installed Windows application.

---

## One-Click Install

1. Download **`JARVIS-Install.bat`** from this repo
2. Double-click it — that's it

The installer automatically:
- Installs **Git** and **Node.js v20 LTS** if missing
- Installs **Ollama** (Local AI Engine) silently
- Downloads the **Llama 3.2** AI model (2 GB, one-time download)
- Sets up **Ollama** to auto-start with Windows
- Clones this repo and installs all dependencies
- Creates a **Desktop shortcut** and **Start Menu** entry
- Launches JARVIS

---

## Features

- **Arc Reactor** boot animation with status updates
- **Iron Man HUD** with real-time CPU/RAM gauges
- **Voice Control** (STT + TTS) — sounds like JARVIS
- **Wake Word**: say "Hey JARVIS" to trigger listening
- **Local AI**: Powered by Llama 3.2 (private, free, no internet needed)
- **Cloud AI**: Supports OpenAI (GPT-4o) and Google Gemini
- **PC Control**: volume, screenshots, apps, web search, lock screen
- **System Tray**: minimizes to tray, never closes (Alt+J to toggle)
- **Auto-Update**: checks GitHub on every launch to stay current

---

## PC Commands

- `screenshot`, `volume up/down`, `mute`
- `open browser/notepad/calculator/task manager/file manager`
- `lock screen`, `show desktop`, `empty recycle bin`
- `search for [query]`, `play [song] on youtube`
- `update` — check for updates manually

---

## Setup

JARVIS defaults to **Local AI (Ollama)**. If you want to use OpenAI or Gemini, click the **Settings (gear icon)** in the HUD to add your API keys.

---

## Manual Install

```bash
git clone https://github.com/mercy1234544/jarvis-ai.git
cd jarvis-ai
npm install
npm start
```

*Built by mercy1234544*
