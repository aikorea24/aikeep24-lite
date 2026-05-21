/**
 * AIKeep24-Lite - background.js
 * 원본 background.js에서 LLM 큐(ollama/optiq/neurons) 제거.
 * ping, reload, 설정 동기화만 유지.
 */
console.log('[CKL-BG] AIKeep24-Lite service worker loaded v0.1.0');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'ping') {
    sendResponse({ok: true, msg: 'pong'});
    return true;
  }
  if (request.type === 'reload_extension') {
    chrome.runtime.reload();
    return;
  }
});
