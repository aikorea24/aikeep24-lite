/**
 * AIKeep24 - DOM 파서 (Genspark 대화 추출)
 */
(function() {
  var CK = window.CK;

  /**
   * 현재 URL에서 플랫폼을 자동 감지한다.
   */
  CK.detectPlatform = function() {
    var host = window.location.hostname;
    var platforms = CK.CONFIG.PLATFORMS;
    for (var key in platforms) {
      if (host.indexOf(platforms[key].hostMatch) > -1) return platforms[key];
    }
    return platforms.genspark; // fallback
  };

  CK.getPlatformKey = function() {
    var host = window.location.hostname;
    var platforms = CK.CONFIG.PLATFORMS;
    for (var key in platforms) {
      if (host.indexOf(platforms[key].hostMatch) > -1) return key;
    }
    return 'genspark';
  };

  CK.getChatId = function() {
    var path = window.location.pathname;
    // Claude: /chat/uuid
    var claudeMatch = path.match(/\/chat\/([a-f0-9-]+)/);
    if (claudeMatch) return claudeMatch[1];
    // ChatGPT: /c/uuid
    var chatgptMatch = path.match(/\/c\/([a-f0-9-]+)/);
    if (chatgptMatch) return chatgptMatch[1];
    // Genspark: ?id=xxx
    try {
      var params = new URLSearchParams(window.location.search);
      var id = params.get('id');
      if (id) return id;
    } catch(e) {}
    return path.replace(/\//g, '_');
  };

  CK.extractTurns = function() {
    var platform = CK.detectPlatform();

    // Claude: turnSelector가 없으므로 부모 컨테이너 구조로 추출
    if (!platform.turnSelector) {
      var result = [];
      var userMsgs = document.querySelectorAll('[data-testid="user-message"]');
      if (userMsgs.length > 0) {
        var container = userMsgs[0];
        for (var d = 0; d < 10; d++) {
          container = container.parentElement;
          if (!container) break;
          if (container.children.length >= 4) break;
        }
        if (container) {
          var blocks = container.children;
          for (var b = 0; b < blocks.length; b++) {
            var block = blocks[b];
            var hasUser = block.querySelector('[data-testid="user-message"]');
            var text = (block.innerText || '').trim();
            if (text.length < 5) continue;
            result.push({ role: hasUser ? 'user' : 'assistant', text: text });
          }
        }
      }
      return result;
    }

    var els = document.querySelectorAll(platform.turnSelector);
    var result = [];
    // 건너뛸 시스템 메시지 패턴
    var SKIP_PATTERNS = [
      '성능 향상을 위해 이전 채팅 기록이 압축되었습니다',
      '이전 채팅 기록이 압축',
      'previous messages have been summarized',
      'conversation has been compressed'
    ];

    els.forEach(function(el) {
      var role = platform.roleDetect(el);
      var text = el.innerText.trim();
      if (text.length === 0) return;
      // 시스템 압축 메시지 건너뛰기
      var isSkip = SKIP_PATTERNS.some(function(p) { return text.indexOf(p) > -1; });
      if (isSkip) return;
      result.push({ role: role, text: text });
    });
    return result;
  };

  CK.formatChunk = function(turnList) {
    return turnList.map(function(t) {
      var label = t.role === 'user' ? 'USER' : 'ASSISTANT';
      return '## [' + label + ']\n\n' + t.text;
    }).join('\n\n---\n\n');
  };

  /**
   * 해시 기반 변경 감지: 마지막 턴 텍스트의 앞 N자를 해시
   */
  CK.computeTurnHash = function(turns) {
    if (!turns || turns.length === 0) return '';
    var lastText = turns[turns.length - 1].text || '';
    var prefix = lastText.substring(0, CK.CONFIG.HASH_PREFIX_LEN);
    return CK.hashText(prefix);
  };

  /**
   * 대화 유형 필터링: 요약 불필요한 대화인지 판단
   */
  CK.shouldSkipConversation = function() {
    var url = window.location.href;
    var patterns = CK.CONFIG.SKIP_PATTERNS;
    for (var i = 0; i < patterns.length; i++) {
      if (url.indexOf(patterns[i]) > -1) return true;
    }
    var platform = CK.detectPlatform();
    if (platform.skipSelectors) {
      var imgEls = document.querySelectorAll(platform.skipSelectors);
      var turnEls = platform.turnSelector ? document.querySelectorAll(platform.turnSelector) : [];
      if (imgEls.length > 0 && turnEls.length <= 4) return true;
    }
    return false;
  };

})();

/* ============================================================
   셀렉터 복원력 시스템 (v0.5.0)
   ============================================================ */

CK._selectorsFetched = false;

CK.fetchRemoteSelectors = async function() {
  if (CK._selectorsFetched) return;
  CK._selectorsFetched = true;
  try {
    var endpoint = CK.CONFIG.SELECTOR_UPDATE_URL ||
      (CK.CONFIG.WORKER_URL + '/api/selectors');
    var res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return;
    var data = await res.json();
    if (data.version > (CK.CONFIG.SELECTOR_VERSION || 0)) {
      Object.keys(data.platforms || {}).forEach(function(key) {
        if (CK.CONFIG.PLATFORMS[key]) {
          Object.assign(CK.CONFIG.PLATFORMS[key], data.platforms[key]);
          console.info('[CK] 셀렉터 원격 업데이트:', key, 'v' + data.version);
        }
      });
      CK.CONFIG.SELECTOR_VERSION = data.version;
    }
  } catch(e) { /* 네트워크 오류 무시 */ }
};

CK.validateSelectors = function() {
  var platform = CK.detectPlatform ? CK.detectPlatform() : null;
  if (!platform) return { ok: false, reason: 'unknown_platform' };
  var warnings = [];

  if (platform.turnSelector) {
    if (document.querySelectorAll(platform.turnSelector).length === 0)
      warnings.push('turnSelector 매칭 없음: ' + platform.turnSelector);
  }
  if (platform.roleDetect === 'dual-selector') {
    var u = platform.userSelector ?
      document.querySelectorAll(platform.userSelector).length : 0;
    var a = platform.assistantSelector ?
      document.querySelectorAll(platform.assistantSelector).length : 0;
    if (u === 0 && a === 0) {
      warnings.push('USER/ASSISTANT 셀렉터 모두 매칭 없음');
      return { ok: false, reason: 'selector_broken', warnings: warnings };
    }
  }
  return { ok: warnings.length === 0, warnings: warnings };
};

CK.showSelectorWarning = function(platformName, broken) {
  if (document.getElementById('ck-selector-warn')) return;
  var banner = document.createElement('div');
  banner.id = 'ck-selector-warn';
  var bg = broken ? '#ef4444' : '#f59e0b';
  banner.style.cssText =
    'position:fixed;bottom:70px;right:16px;' +
    'background:' + bg + ';color:#fff;' +
    'padding:10px 14px;border-radius:8px;font-size:12px;' +
    'z-index:2147483647;max-width:260px;line-height:1.6;' +
    'box-shadow:0 2px 12px rgba(0,0,0,0.25);font-family:sans-serif;';
  var icon = broken ? '🔴' : '⚠️';
  var title = broken ? ' 저장 실패' : ' 저장 불완전 가능성';
  var body = broken
    ? '<b>' + platformName + '</b> UI가 변경되어<br>대화를 인식하지 못했습니다.'
    : '<b>' + platformName + '</b> UI가 변경된 것 같습니다.<br>저장이 불완전할 수 있습니다.';
  banner.innerHTML =
    '<div style="font-weight:bold;margin-bottom:4px">' + icon + title + '</div>' +
    body +
    '<div style="margin-top:8px;font-size:11px;opacity:0.8">' +
    '자동으로 복구를 시도합니다.</div>' +
    '<button onclick="this.parentElement.remove()" ' +
    'style="position:absolute;top:6px;right:8px;background:none;border:none;' +
    'color:#fff;cursor:pointer;font-size:14px;">✕</button>';
  banner.style.position = 'fixed';
  document.body.appendChild(banner);
  setTimeout(function() {
    var el = document.getElementById('ck-selector-warn');
    if (el) el.remove();
  }, 8000);
};

CK.reportBrokenSelector = function(platform, selector) {
  var url = CK.CONFIG.WORKER_URL + '/api/report';
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: platform,
      url: window.location.href,
      selector: selector
    })
  }).catch(function() {});
};
