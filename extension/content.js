// content.js — Context Keeper v2
// Injected into ChatGPT, Gemini, Claude, and Kimi pages.
// Receives the handoff prompt from popup.js and types it into the chat input.

// ── Input element selectors (multiple fallbacks per platform) ──────────────────
// LLM chat UIs change their DOM frequently, so we try several selectors in order
// and use the first one that finds a visible element.

const INPUT_SELECTORS = {
  chatgpt: [
    '#prompt-textarea',                                   // current stable selector
    'textarea[data-id="root"]',
    'div[contenteditable="true"][data-lexical-editor]',   // new editor variants
    'div[contenteditable="true"]',
    'textarea',
  ],
  gemini: [
    'div.ql-editor[contenteditable="true"]',              // Quill editor
    'rich-textarea > div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
  ],
  claude: [
    'div[contenteditable="true"].ProseMirror',            // ProseMirror editor
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
    'fieldset div[contenteditable="true"]',
    'div[contenteditable="true"]',
  ],
  kimi: [
    'textarea#chat-input',
    'textarea[placeholder]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
  ],
};

// ── Send button selectors (tried before falling back to Enter key) ─────────────

const SEND_SELECTORS = {
  chatgpt: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send prompt"]',
  ],
  gemini: [
    'button[aria-label="Send message"]',
    'button.send-button',
    'button[jsname="WRWHed"]',       // Google's internal jsname attribute
    'button[data-test-id="send-button"]',
  ],
  claude: [
    'button[aria-label="Send message"]',
    'button[aria-label="Send Message"]',
    'button[type="submit"]',
  ],
  kimi: [
    'button[aria-label="Send"]',
    'button[class*="send"]',
    'button[data-testid="send-btn"]',
    'button[type="submit"]',
  ],
};

// ── Detect which platform we are on ────────────────────────────────────────────

function getPlatform() {
  const host = window.location.hostname;
  if (host.includes('chatgpt.com') || host.includes('openai.com')) return 'chatgpt';
  if (host.includes('google.com'))  return 'gemini';
  if (host.includes('claude.ai'))   return 'claude';
  if (host.includes('kimi.ai'))     return 'kimi';
  return null;
}

// ── Find the first visible input element ───────────────────────────────────────

/**
 * Walks the selector list for the given platform and returns the first
 * element that is actually rendered (not hidden by display:none, etc.).
 */
function findInput(platform) {
  const selectors = INPUT_SELECTORS[platform] || [];
  for (const sel of selectors) {
    const candidates = document.querySelectorAll(sel);
    for (const el of candidates) {
      // offsetParent is null only for elements that are not rendered at all.
      // getBoundingClientRect height > 0 catches sticky/fixed elements.
      if (el.offsetParent !== null || el.getBoundingClientRect().height > 0) {
        return el;
      }
    }
  }
  return null;
}

// ── Fill a <textarea> (handles React's synthetic event system) ─────────────────

/**
 * React overrides the native HTMLTextAreaElement value setter so that setting
 * el.value directly doesn't trigger its onChange handler.
 * We grab the *original* setter from the prototype before React replaced it,
 * then dispatch a real 'input' event so React picks up the change.
 */
function fillTextarea(el, text) {
  el.focus();

  // Use React's native input value setter trick
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, 'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(el, text);
  } else {
    el.value = text;
  }

  // Fire events so React / Vue / other frameworks register the change
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Fill a contenteditable div (ProseMirror, Quill, Lexical) ──────────────────

/**
 * execCommand('insertText') is the most compatible way to insert text into
 * rich editors because it goes through the browser's editing pipeline,
 * which both ProseMirror and Quill listen to internally.
 *
 * We first select all existing content so the prompt replaces rather than
 * appends to whatever the user had typed.
 */
function fillContentEditable(el, text) {
  el.focus();

  // Select all existing content in the editable element
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  // Insert our text — triggers editor change handlers in ProseMirror / Quill
  const inserted = document.execCommand('insertText', false, text);

  // Fallback: directly overwrite the text node and fire events manually.
  // Some editors (e.g. older Quill) ignore execCommand in certain states.
  if (!inserted || el.textContent.trim() === '') {
    el.textContent = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new InputEvent('input', {
      data: text,
      inputType: 'insertText',
      bubbles: true,
    }));
  }
}

// ── Click the send button ──────────────────────────────────────────────────────

/**
 * Returns true if a visible, enabled send button was found and clicked.
 */
function clickSendButton(platform) {
  const selectors = SEND_SELECTORS[platform] || [];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && !btn.disabled && btn.offsetParent !== null) {
      btn.click();
      return true;
    }
  }
  return false;
}

// ── Simulate pressing Enter inside the input ───────────────────────────────────

function pressEnter(el) {
  const opts = {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true,
  };
  el.dispatchEvent(new KeyboardEvent('keydown',  opts));
  el.dispatchEvent(new KeyboardEvent('keypress', opts));
  el.dispatchEvent(new KeyboardEvent('keyup',    opts));
}

// ── ChatGPT-specific injection (React-controlled ProseMirror) ─────────────────

/**
 * ChatGPT uses a React-controlled ProseMirror contenteditable div.
 * Normal value setting and execCommand do not work reliably on their own.
 * This function uses a specific sequence: clear innerHTML, fire input event,
 * insertText via execCommand, then re-fire events after a short delay before
 * submitting so React has time to register the content.
 */
function injectChatGPT(text) {
  const selectors = [
    '#prompt-textarea',
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]'
  ];

  let el = null;
  for (const sel of selectors) {
    el = document.querySelector(sel);
    if (el) break;
  }

  if (!el) return false;

  el.focus();
  el.innerHTML = '';
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text);
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));

  setTimeout(() => {
    const btn = document.querySelector('button[data-testid="send-button"]');
    if (btn && !btn.disabled) {
      btn.click();
    } else {
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true
      }));
    }
  }, 800);

  return true;
}

// ── Claude.ai-specific injection (React-controlled ProseMirror) ───────────────

/**
 * Claude.ai uses a React-controlled ProseMirror contenteditable div,
 * identical in structure to ChatGPT's editor. The same clear-then-insertText
 * sequence is required for React to register the new content.
 */
function injectClaudeAI(text, callback) {
  // STEP 1 — find the input element
  const element =
    document.querySelector('div[contenteditable="true"].ProseMirror') ||
    document.querySelector('div.ProseMirror[contenteditable="true"]') ||
    document.querySelector('fieldset div[contenteditable="true"]') ||
    document.querySelector('div[contenteditable="true"]');

  if (!element) {
    callback({
      success: false,
      error: 'Claude input not found. Make sure the chat page is fully loaded.',
    });
    return;
  }

  // STEP 2 — clear and set text via ProseMirror-compatible approach
  element.focus();
  element.innerHTML = '';
  element.dispatchEvent(new InputEvent('input', { bubbles: true }));

  document.execCommand('insertText', false, text);

  setTimeout(() => {
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, 500);

  // STEP 3 — submit after 1000 ms
  setTimeout(() => {
    const sendBtn =
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label="Send Message"]') ||
      document.querySelector('button[type="submit"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      }));
    }
    callback({ success: true });
  }, 1000);
}

// ── Gemini-specific injection (Quill editor inside rich-textarea) ─────────────

/**
 * Gemini wraps a Quill contenteditable div inside a <rich-textarea> web
 * component. Quill listens to the browser editing pipeline, so the same
 * clear-then-insertText sequence used for ProseMirror works here too.
 */
function injectGemini(text, callback) {
  // STEP 1 — find the input element
  const element =
    document.querySelector('div.ql-editor[contenteditable="true"]') ||
    document.querySelector('rich-textarea > div[contenteditable="true"]') ||
    document.querySelector('div[contenteditable="true"][role="textbox"]') ||
    document.querySelector('div[contenteditable="true"]');

  if (!element) {
    callback({
      success: false,
      error: 'Gemini input not found. Make sure the chat page is fully loaded.',
    });
    return;
  }

  // STEP 2 — clear and set text via Quill-compatible approach
  element.focus();
  element.innerHTML = '';
  element.dispatchEvent(new InputEvent('input', { bubbles: true }));

  document.execCommand('insertText', false, text);

  setTimeout(() => {
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, 500);

  // STEP 3 — submit after 1000 ms
  setTimeout(() => {
    const sendBtn =
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button.send-button') ||
      document.querySelector('button[jsname="WRWHed"]') ||
      document.querySelector('button[data-test-id="send-button"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      }));
    }
    callback({ success: true });
  }, 1000);
}

// ── Kimi-specific injection (textarea or contenteditable) ─────────────────────

/**
 * Kimi may render either a plain <textarea> or a contenteditable div depending
 * on the page state. We detect which one we found and use the appropriate path:
 * - textarea  → React native-setter trick + input/change events
 * - contenteditable → same ProseMirror clear-then-insertText sequence used for
 *   ChatGPT and Claude.ai
 */
function injectKimi(text) {
  const selectors = [
    'textarea',
    'div[contenteditable="true"]',
    '.chat-input textarea',
    '[placeholder]'
  ];

  let el = null;
  for (const sel of selectors) {
    el = document.querySelector(sel);
    if (el) break;
  }

  if (!el) return false;

  el.focus();

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    el.value = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  setTimeout(() => {
    const btn = document.querySelector('button[type="submit"]') ||
                document.querySelector('button.send') ||
                document.querySelector('button[aria-label*="send" i]');
    if (btn) {
      btn.click();
    } else {
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true
      }));
    }
  }, 800);

  return true;
}

// ── Main injection function ────────────────────────────────────────────────────

/**
 * 1. Detect platform
 * 2. Find the input element
 * 3. Fill it with the handoff prompt
 * 4. Submit after a short delay (so the platform's framework can register the text)
 * 5. Call callback({ success: true|false, error?: string })
 */
function injectPrompt(promptText, callback) {
  const platform = getPlatform();
  if (!platform) {
    callback({ success: false, error: 'Unsupported platform.' });
    return;
  }

  if (platform === 'chatgpt') {
    const ok = injectChatGPT(promptText);
    callback({ success: ok, error: ok ? undefined : 'ChatGPT input not found. Make sure the chat page is fully loaded.' });
    return;
  }
  if (platform === 'gemini')  { injectGemini(promptText, callback);   return; }
  if (platform === 'claude')  { injectClaudeAI(promptText, callback); return; }
  if (platform === 'kimi') {
    const ok = injectKimi(promptText);
    callback({ success: ok, error: ok ? undefined : 'Kimi input not found. Make sure the chat page is fully loaded.' });
    return;
  }

  const inputEl = findInput(platform);
  if (!inputEl) {
    callback({
      success: false,
      error: 'Chat input not found. Scroll to the chat input box and try again.',
    });
    return;
  }

  // Fill the input with the prompt text
  if (inputEl.tagName === 'TEXTAREA') {
    fillTextarea(inputEl, promptText);
  } else {
    // contenteditable div (ProseMirror, Quill, Lexical, etc.)
    fillContentEditable(inputEl, promptText);
  }

  // Wait for the framework to acknowledge the new content before submitting.
  // 350 ms is enough for React/ProseMirror re-renders without feeling slow.
  setTimeout(() => {
    const submitted = clickSendButton(platform);
    if (!submitted) {
      // If no send button was found, simulate pressing Enter
      pressEnter(inputEl);
    }
    callback({ success: true });
  }, 350);
}

// ── Message listener (called by popup.js) ─────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'inject') {
    // Return true immediately to keep the message channel open for the async callback.
    // Without this, Chrome closes the channel before injectPrompt calls sendResponse.
    injectPrompt(message.prompt, sendResponse);
    return true;
  }
});
