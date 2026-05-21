/**
 * AIKeep24-Lite - background.js (Service Worker)
 *
 * v0.1.0 역할: 탭 URL 변경 감지 → content script에 재초기화 신호 전송.
 * LLM / API 호출 없음.
 */

/**
 * 탭이 완전히 로드된 후 content script에 init 메시지를 보낸다.
 * SPA(ChatGPT 등)에서 URL 변경 시 새 대화를 정확히 감지하기 위함.
 */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;

  var supportedHosts = ['chatgpt.com', 'claude.ai', 'genspark.ai'];
  var url = tab.url || '';
  var isSupported = supportedHosts.some(function(host) {
    return url.indexOf(host) > -1;
  });

  if (!isSupported) return;

  // content script에 탭 로드 완료 알림
  chrome.tabs.sendMessage(tabId, { type: 'TAB_LOADED', url: url }, function() {
    // 응답 없어도 무시 (content script 아직 로드 중일 수 있음)
    if (chrome.runtime.lastError) {}
  });
});
