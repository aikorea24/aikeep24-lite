/**
 * AIKeep24-Lite - DOM 파서
 *
 * 기존 AIKeep24 dom-parser.js를 LLM 의존 없이 포팅.
 * 변경점:
 *  - window.CK → window.CKL (네임스페이스 분리)
 *  - Claude 추출 로직 강화: data-is-streaming 속성 필터링 추가
 *  - shouldSkipConversation 유지 (이미지 생성 탭 제외)
 */
(function() {
  'use strict';

  var CKL = window.CKL;

  /**
   * 현재 탭 URL의 hostname으로 플랫폼 객체를 반환한다.
   * @returns {Object} PLATFORMS 맵의 플랫폼 객체
   */
  CKL.detectPlatform = function() {
    var host = window.location.hostname;
    var platforms = CKL.CONFIG.PLATFORMS;
    for (var key in platforms) {
      if (platforms.hasOwnProperty(key)) {
        if (host.indexOf(platforms[key].hostMatch) > -1) return platforms[key];
      }
    }
    return platforms.genspark; // fallback
  };

  /**
   * 플랫폼 키 문자열을 반환한다 ('chatgpt' | 'claude' | 'genspark').
   * @returns {string}
   */
  CKL.getPlatformKey = function() {
    var host = window.location.hostname;
    var platforms = CKL.CONFIG.PLATFORMS;
    for (var key in platforms) {
      if (platforms.hasOwnProperty(key)) {
        if (host.indexOf(platforms[key].hostMatch) > -1) return key;
      }
    }
    return 'genspark';
  };

  /**
   * 현재 대화의 고유 ID를 URL에서 추출한다.
   * Claude:   /chat/{uuid}
   * ChatGPT:  /c/{uuid}
   * Genspark: ?id={value}
   * 기타:     pathname을 '_' 치환
   * @returns {string}
   */
  CKL.getChatId = function() {
    var path = window.location.pathname;

    var claudeMatch = path.match(/\/chat\/([a-f0-9-]+)/);
    if (claudeMatch) return claudeMatch[1];

    var chatgptMatch = path.match(/\/c\/([a-f0-9-]+)/);
    if (chatgptMatch) return chatgptMatch[1];

    try {
      var params = new URLSearchParams(window.location.search);
      var id = params.get('id');
      if (id) return id;
    } catch(e) {}

    return path.replace(/\//g, '_').replace(/^_/, '');
  };

  /**
   * Claude.ai의 parent-structure 방식으로 턴을 추출한다.
   * [data-testid="user-message"] 를 앵커로 컨테이너를 찾고,
   * 스트리밍 중인 블록(data-is-streaming)은 제외한다.
   * @returns {Array<{role: string, text: string}>}
   */
  function extractClaudeTurns() {
    var result = [];
    var userMsgs = document.querySelectorAll('[data-testid="user-message"]');
    if (userMsgs.length === 0) return result;

    // 공통 조상 컨테이너 탐색 (최대 10단계, children >= 4 조건)
    var container = userMsgs[0];
    for (var d = 0; d < 10; d++) {
      container = container.parentElement;
      if (!container) break;
      if (container.children.length >= 4) break;
    }
    if (!container) return result;

    var blocks = container.children;
    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];

      // 스트리밍 중인 블록 제외 (불완전 텍스트 저장 방지)
      if (block.getAttribute('data-is-streaming') === 'true') continue;

      var hasUser = block.querySelector('[data-testid="user-message"]');
      var text = (block.innerText || '').trim();
      if (text.length < 5) continue;

      result.push({ role: hasUser ? 'user' : 'assistant', text: text });
    }
    return result;
  }

  /**
   * 현재 플랫폼에서 모든 대화 턴을 추출한다.
   * @returns {Array<{role: string, text: string}>}
   */
  CKL.extractTurns = function() {
    var platform = CKL.detectPlatform();

    // Claude: turnSelector 없음 → parent-structure 방식
    if (!platform.turnSelector) {
      return extractClaudeTurns();
    }

    var els = document.querySelectorAll(platform.turnSelector);
    var result = [];
    els.forEach(function(el) {
      // 스트리밍 중인 요소 제외
      if (el.getAttribute('data-is-streaming') === 'true') return;

      var role = platform.roleDetect(el);
      var text = (el.innerText || '').trim();
      if (text.length > 0) {
        result.push({ role: role, text: text });
      }
    });
    return result;
  };

  /**
   * 턴 배열을 저장용 raw text 형식으로 직렬화한다.
   * 형식: "[USER]\n...\n\n---\n\n[ASSISTANT]\n..."
   * @param {Array<{role: string, text: string}>} turnList
   * @returns {string}
   */
  CKL.formatChunk = function(turnList) {
    return turnList.map(function(t) {
      var label = t.role === 'user' ? 'USER' : 'ASSISTANT';
      return '[' + label + ']\n' + t.text;
    }).join('\n\n---\n\n');
  };

  /**
   * 마지막 턴 텍스트 앞 N자를 FNV-1a 해시한 값을 반환한다.
   * 변경 감지에 사용: 동일 해시면 저장 생략.
   * @param {Array<{role: string, text: string}>} turns
   * @returns {string} hex hash 또는 ''
   */
  CKL.computeTurnHash = function(turns) {
    if (!turns || turns.length === 0) return '';
    var lastText = turns[turns.length - 1].text || '';
    var prefix = lastText.substring(0, CKL.CONFIG.HASH_PREFIX_LEN);
    return CKL.hashText(prefix);
  };

  /**
   * 현재 대화가 저장 불필요한 유형인지 판단한다.
   * URL 패턴(이미지/드로잉) 또는 DOM 기반 이미지 생성 감지.
   * @returns {boolean} true면 저장 건너뜀
   */
  CKL.shouldSkipConversation = function() {
    var url = window.location.href;
    var patterns = CKL.CONFIG.SKIP_PATTERNS;
    for (var i = 0; i < patterns.length; i++) {
      if (url.indexOf(patterns[i]) > -1) return true;
    }

    var platform = CKL.detectPlatform();
    if (platform.skipSelectors) {
      var imgEls = document.querySelectorAll(platform.skipSelectors);
      var turnEls = platform.turnSelector
        ? document.querySelectorAll(platform.turnSelector)
        : [];
      // 이미지 요소 있고 텍스트 턴이 4개 이하이면 이미지 생성 대화로 판단
      if (imgEls.length > 0 && turnEls.length <= 4) return true;
    }
    return false;
  };

})();
