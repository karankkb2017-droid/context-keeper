# Context Keeper — Browser Extension (v2)

A Chrome / Edge extension that injects a structured handoff prompt into any supported LLM chat with a single click, so you never lose your context when you hit a token limit.

---

## What It Does

When you are deep in a conversation on ChatGPT, Gemini, Claude, or Kimi and the chat is approaching its limit:

1. Click the **Context Keeper icon** in your browser toolbar.
2. Pick your work type: **Coding**, **Writing**, or **Research**.
3. Click **Inject Handoff Prompt**.
4. The extension automatically types the prompt into the chat box and submits it.
5. The LLM generates a structured summary of everything — your code, decisions, draft, findings.
6. Copy that summary and paste it into a new LLM chat to continue seamlessly.

No copy-pasting prompts. No setup. No API keys. It just works.

---

## How to Install in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The Context Keeper icon (orange) appears in your toolbar

> If the icon is hidden, click the puzzle piece (Extensions) icon in the toolbar and pin Context Keeper.

---

## How to Install in Microsoft Edge

1. Open Edge and go to `edge://extensions`
2. Enable **Developer mode** (toggle in the bottom-left)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The Context Keeper icon appears in your toolbar

The extension uses Manifest V3, which works identically on Chrome and Edge — no changes needed.

---

## How to Use (4 Steps)

```
Step 1 — Navigate to ChatGPT, Gemini, Claude, or Kimi and start chatting.

Step 2 — When approaching the message/token limit, click the 
         Context Keeper icon in your toolbar.
         The popup shows which platform was detected.

Step 3 — Pick your category:
         💻 Coding   — for programming and engineering sessions
         ✍️ Writing  — for essays, stories, emails, content
         🔬 Research — for investigation, analysis, learning

Step 4 — Click "Inject Handoff Prompt".
         The extension types the prompt and submits it automatically.
         Wait for the LLM to generate the full handoff summary.
         Copy it → open a new chat → paste → continue.
```

---

## Supported Platforms

| Platform | URL |
|---|---|
| ChatGPT | chat.openai.com |
| Gemini | gemini.google.com |
| Claude | claude.ai |
| Kimi | kimi.ai |

---

## File Structure

```
extension/
├── manifest.json          # Chrome/Edge Manifest V3 config
├── popup.html             # Toolbar popup UI (dark theme, 320px)
├── popup.js               # Popup logic: platform detection, injection trigger
├── content.js             # Page script: finds the input and types the prompt
├── background.js          # Service worker (minimal — required by MV3)
├── icons/
│   ├── icon16.png         # 16×16 toolbar icon
│   ├── icon48.png         # 48×48 extension management icon
│   └── icon128.png        # 128×128 Chrome Web Store icon
└── README_extension.md    # This file
```

---

## How It Connects to Context Keeper v1

**v1** (`context_keeper.py`) is a Streamlit web app — you run it locally, pick a category, and it displays a handoff prompt that you manually copy and paste into your LLM chat.

**v2** (this extension) removes the manual steps entirely. The extension lives in your browser toolbar, detects which LLM you are on, and physically types and submits the prompt for you. No Streamlit server required — the extension works standalone.

Both versions use the same three handoff templates (Coding / Writing / Research) and the same dark-orange visual style.

---

## Troubleshooting

**"Could not reach the page"** — Refresh the chat tab, then try again. The content script needs the page to be fully loaded.

**"Chat input not found"** — Scroll to the bottom of the chat so the input box is visible, then click Inject again.

**The prompt was typed but not submitted** — Some LLM UIs update their send buttons dynamically. Click the send button manually after injection.

**Extension icon is grey / inactive** — Make sure you are on one of the four supported URLs. The popup shows "No supported platform found" on other sites.

---

## Technical Notes (for learners)

- **Manifest V3** — the current Chrome extension standard. Background scripts are service workers instead of persistent pages.
- **content.js** runs inside the LLM page's context and has direct access to the DOM.
- **popup.js** runs inside the popup window, which is a separate context — it communicates with content.js via `chrome.tabs.sendMessage`.
- **React compatibility** — ChatGPT's textarea is controlled by React, which ignores direct `.value =` assignments. We use the `HTMLTextAreaElement.prototype` native setter trick to bypass React's override.
- **ProseMirror / Quill** — Claude and Gemini use rich text editors. `document.execCommand('insertText')` is the most reliable way to insert text that the editor's change detection will notice.

---

## License

MIT — same as Context Keeper v1.
