# 🔗 Context Keeper

**Never lose your LLM conversation context again.**

Context Keeper helps you seamlessly continue your AI conversations across ChatGPT, Gemini, and Claude when you hit token/message limits. Instead of starting from scratch on a new platform, you get a perfect "handoff prompt" that preserves your full context — code, decisions, drafts, and progress.

---

## 🎯 The Problem

You're deep into a coding project with ChatGPT. You've written 50 messages of context — your architecture, your bugs, your decisions. Then ChatGPT free tier says: **"You've reached your limit."**

Now what? Restart everything in Gemini? Spend 20 minutes re-explaining? Lose all that progress?

**Context Keeper solves this.**

---

## ✨ How It Works

1. **Before** your chat dies, pick your work type (Coding / Writing / Research)
2. **Copy** the generated handoff prompt
3. **Paste** it into your current LLM — it produces a structured summary of everything
4. **Copy** that summary, paste into ANY other LLM
5. **Continue working** without losing a single decision or line of code

---

## 🛠️ Tech Stack

- **Python 3.8+**
- **Streamlit** — clean, fast web UI
- **JSON** — local storage for handoff history
- No API keys required, no costs, no cloud dependencies

---

## 🚀 Quick Start

```bash
# Clone or download this folder
cd context-keeper

# Install dependencies
pip install -r requirements.txt

# Run the app
streamlit run context_keeper.py
```

The app opens in your browser at `http://localhost:8501`.

---

## 📁 Project Structure

```
context-keeper/
├── context_keeper.py      # Main Streamlit app
├── requirements.txt       # Python dependencies
├── handoff_history.json   # Auto-created: your saved handoffs
└── README.md              # This file
```

---

## 🎨 Features

- ✅ Three pre-built handoff templates (Coding, Writing, Research)
- ✅ Save and reuse past handoff prompts locally
- ✅ One-click links to ChatGPT, Gemini, and Claude
- ✅ Clean, minimal UI with dark theme
- ✅ Zero API keys, zero costs, fully offline-capable

---

## 🗺️ Roadmap

**v1 (current)** — Prompt generator with local history

**v2** — Browser extension that auto-extracts conversations from LLM chat pages

**v3** — Optional Gemini API integration for "rescue mode" (cleans up already-dead chat transcripts)

**v4** — Cross-device sync, custom templates, team sharing

---

## 👤 Author

Built by **Kade (Karan Beldar)** — software engineering portfolio project.

Solves a real problem I face every day while learning to code with AI assistants.

---

## 📄 License

MIT
