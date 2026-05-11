// background.js — Context Keeper v2
// Minimal service worker required by Manifest V3.
// All heavy lifting happens in content.js and popup.js.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Context Keeper v2 installed. Open ChatGPT, Gemini, Claude, or Kimi to use it.');
});
