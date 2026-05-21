/**
 * AIKeep24-Lite - Entry Point
 * 원본 AIKeep24 content.js 패턴 그대로 유지.
 * 모듈 로드 순서: config -> dom-parser -> ngram -> storage/* -> search/* -> observer -> ui -> content
 */
(function() {
  var CKL = window.CKL;

  function init() {
    /* 원본과 동일: conversation 컨테이너 우선, 없으면 body */
    var target = document.querySelector('.conversation-content')
      || document.querySelector('.chat-wrapper')
      || document.body;

    CKL.observer.observe(target, { childList: true, subtree: true });

    /* body 변경 시 UI 재삽입 (SPA 페이지 전환 대응) */
    var bodyObserver = new MutationObserver(function() { CKL.ensureUI(); });
    bodyObserver.observe(document.body, { childList: true });

    CKL.ensureUI();

    /* keepalive ping — 원본과 동일 */
    setInterval(function() {
      try { chrome.runtime.sendMessage({type: 'ping'}, function() { if (chrome.runtime.lastError) {} }); } catch(e) {}
    }, 20000);

    console.log('[CKL] AIKeep24-Lite v0.1.0 active');
    CKL.checkForNewTurns();

    /* 검색 인덱스 초기화 (비동기) */
    CKL.LocalSearch.init().then(function() {
      console.log('[CKL] Search index ready');
    }).catch(function(e) {
      console.warn('[CKL] Search index init failed', e);
    });
  }

  /* 원본과 동일: loadSettings 콜백으로 init 진입 */
  function start() {
    CKL.loadSettings(function() {
      init();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
