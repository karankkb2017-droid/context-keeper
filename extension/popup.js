// popup.js — Context Keeper v2
// Controls the toolbar popup: platform detection, category selection, injection trigger.

// ── Handoff prompts (one per category) ────────────────────────────────────────
// These are the exact prompts sent to the LLM when the user clicks Inject.

const PROMPTS = {

  coding: `We are approaching the chat limit. Before we run out, please create a COMPLETE CONTEXT HANDOFF that I can paste into another LLM to continue this work seamlessly. Format it exactly like this:

CONTEXT HANDOFF — Continuing Previous Session

PROJECT: [what we are building]
TECH STACK: [languages, frameworks, tools with versions]
PROGRESS COMPLETED: [bullet points of what is done]
CURRENT CODE (VERBATIM): [full code of all relevant files, do not summarize, include filenames]
CURRENT PROBLEM: [exact issue we were solving, include error messages]
DECISIONS ALREADY MADE: [choices made and why, so the next LLM does not suggest rejected ideas]
NEXT STEPS: [specific next action]
ABOUT ME: [my experience level and how I like to work]

INSTRUCTIONS FOR NEXT LLM: Read everything above, acknowledge you understand, then continue from NEXT STEPS without re-explaining what we covered.`,

  writing: `We are approaching the chat limit. Before we run out, please create a COMPLETE CONTEXT HANDOFF that I can paste into another LLM to continue this writing project seamlessly. Format it exactly like this:

CONTEXT HANDOFF — Continuing Writing Session

PROJECT: [what I am writing and the topic]
PURPOSE AND AUDIENCE: [who this is for and what it should accomplish]
STYLE AND TONE: [voice, tone, length target, formality, specific style choices]
CURRENT DRAFT (VERBATIM): [full text of the latest version, do not summarize]
KEY IDEAS: [main points, themes, arguments developed]
DECISIONS ALREADY MADE: [approaches tried and rejected, things to avoid]
NEXT STEPS: [what needs to happen next]
ABOUT ME: [my writing background and preferences]

INSTRUCTIONS FOR NEXT LLM: Read carefully, acknowledge the context, then continue from NEXT STEPS.`,

  research: `We are approaching the chat limit. Before we run out, please create a COMPLETE CONTEXT HANDOFF that I can paste into another LLM to continue this research seamlessly. Format it exactly like this:

CONTEXT HANDOFF — Continuing Research Session

TOPIC: [the core question or area being investigated]
GOAL: [what I am trying to learn, decide, or produce]
KEY FINDINGS: [main facts, insights, conclusions discovered so far]
SOURCES MENTIONED: [papers, websites, books, experts referenced]
OPEN QUESTIONS: [what is still unclear or needs more digging]
RULED OUT: [hypotheses or directions already dismissed and why]
NEXT STEPS: [specific research direction to tackle next]
ABOUT ME: [my background on this topic and depth of expertise desired]

INSTRUCTIONS FOR NEXT LLM: Read carefully, acknowledge the context, then continue from NEXT STEPS.`,

};

// ── Platform detection ─────────────────────────────────────────────────────────

/**
 * Given a tab URL string, return the platform object or null.
 * @param {string} url
 * @returns {{ id: string, name: string } | null}
 */
function detectPlatform(url) {
  if (!url) return null;
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) return { id: 'chatgpt', name: 'ChatGPT' };
  if (url.includes('gemini.google.com')) return { id: 'gemini',  name: 'Gemini'  };
  if (url.includes('claude.ai'))         return { id: 'claude',  name: 'Claude'  };
  if (url.includes('kimi.ai'))           return { id: 'kimi',    name: 'Kimi'    };
  return null;
}

// ── DOM references ─────────────────────────────────────────────────────────────

const platformBadge    = document.getElementById('platformBadge');
const platformText     = document.getElementById('platformText');
const mainContent      = document.getElementById('mainContent');
const unsupportedContent = document.getElementById('unsupportedContent');
const injectBtn        = document.getElementById('injectBtn');
const statusMsg        = document.getElementById('statusMsg');
const catBtns          = document.querySelectorAll('.cat-btn');

let selectedCategory = null;  // 'coding' | 'writing' | 'research'
let activeTabId      = null;  // ID of the current browser tab

// ── Initialise: detect platform from current tab URL ──────────────────────────

function applyPlatformUI(url) {
  const platform = detectPlatform(url);
  if (platform) {
    platformBadge.classList.add('detected');
    platformText.textContent = `${platform.name} detected ✓`;
    mainContent.style.display = 'block';
  } else {
    platformBadge.classList.add('unsupported');
    platformText.textContent = 'No supported platform found';
    unsupportedContent.style.display = 'block';
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs || tabs.length === 0) {
    applyPlatformUI(null);
    return;
  }

  const tab = tabs[0];
  activeTabId = tab.id;

  // tab.url can be undefined in Chrome MV3 even with "tabs" permission;
  // pendingUrl is available when the tab is still loading.
  const url = tab.url || tab.pendingUrl;
  if (url) {
    applyPlatformUI(url);
    return;
  }

  // Last resort: ask the page itself for its URL via scripting.
  // This only works for tabs covered by host_permissions but those are exactly
  // the sites we care about.
  chrome.scripting.executeScript(
    { target: { tabId: tab.id }, func: () => location.href },
    (results) => {
      const currentUrl = results?.[0]?.result ?? null;
      applyPlatformUI(currentUrl);
    }
  );
});

// ── Category button clicks ─────────────────────────────────────────────────────

catBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    // Deselect all, then mark this one active
    catBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    selectedCategory = btn.dataset.category;

    // Enable the inject button now that a category is chosen
    injectBtn.disabled = false;
    clearStatus();
  });
});

// ── Inject button click ────────────────────────────────────────────────────────

injectBtn.addEventListener('click', () => {
  if (!selectedCategory) {
    showStatus('Please select a category first.', 'error');
    return;
  }

  const promptText = PROMPTS[selectedCategory];

  // Disable button while in-flight to prevent double-clicks
  injectBtn.disabled = true;
  showStatus('Injecting…', 'success');  // optimistic feedback

  // Send message to content.js running in the active tab
  chrome.tabs.sendMessage(
    activeTabId,
    { action: 'inject', prompt: promptText },
    (response) => {
      // Re-enable button regardless of outcome
      injectBtn.disabled = false;

      // chrome.runtime.lastError is set if the content script isn't reachable
      // (e.g. the page wasn't fully loaded, or the tab was navigated away)
      if (chrome.runtime.lastError) {
        showStatus(
          'Could not reach the page. Refresh the chat tab and try again.',
          'error'
        );
        return;
      }

      if (response && response.success) {
        showStatus(
          'Prompt injected! Wait for the LLM to finish, then copy the handoff summary.',
          'success'
        );
      } else {
        const reason = response?.error || 'Unknown error.';
        showStatus(`Injection failed: ${reason}`, 'error');
      }
    }
  );
});

// ── Helper: show / hide status message ────────────────────────────────────────

function showStatus(message, type) {
  statusMsg.textContent  = message;
  // 'info' is styled same as success (neutral blue would require extra CSS)
  statusMsg.className    = `status ${type === 'info' ? 'success' : type}`;
  statusMsg.style.display = 'block';
}

function clearStatus() {
  statusMsg.style.display = 'none';
  statusMsg.textContent   = '';
  statusMsg.className     = 'status';
}
