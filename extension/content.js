/**
 * AIKeep24 Context Keeper v0.9 - Entry Point
 * 모듈 로드 순서: config -> dom-parser -> ollama -> api -> summarizer -> ui -> observer -> content
 */
(function() {
  console.log('[CK-IIFE] content.js IIFE started');
  var CK = window.CK;

  /** SNAP: 마지막 N턴 클립보드 복사 */
  CK.saveSnap = function() {
    var turns = CK.extractTurns() || [];
    var last = turns.slice(-10);
    var text = CK.formatChunk(last);
    navigator.clipboard.writeText(text).then(function() {
      CK.updateStatus && CK.updateStatus('복사됨');
    });
  };

  /** SEARCH: 검색 패널 토글 */
  CK.openSearchPanel = function() {
    var panel = document.getElementById('ck-search-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      return;
    }
    // 검색 패널 생성
    var sp = document.createElement('div');
    sp.id = 'ck-search-panel';
    sp.style.cssText = 'position:fixed;bottom:60px;right:10px;z-index:999999;' +
      'background:rgba(20,25,40,0.97);border:1px solid rgba(255,255,255,0.15);' +
      'border-radius:12px;padding:12px;width:320px;color:#fff;font-size:13px;';
    sp.innerHTML = '<div style="margin-bottom:8px;font-weight:bold;">🔍 대화 검색</div>' +
      '<input id="ck-search-input" type="text" placeholder="검색어 입력..." ' +
      'style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid #444;' +
      'background:#1e2330;color:#fff;font-size:13px;box-sizing:border-box;">' +
      '<div id="ck-search-results" style="margin-top:8px;max-height:250px;overflow-y:auto;"></div>';
    document.body.appendChild(sp);


    document.getElementById('ck-search-input').addEventListener('input', function(e) {
      var q = e.target.value.trim();
      var resultsEl = document.getElementById('ck-search-results');
      if (!q || q.length < 2) { resultsEl.innerHTML = ''; return; }
      if (window._ckEngine) {
        Promise.resolve(window._ckEngine.search(q)).then(function(results) {
          resultsEl.innerHTML = results.slice(0,5).map(function(r) {
            // snippet은 extractSnippet()이 반환한 HTML, raw_content는 텍스트 fallback
            var snippetHtml = (r.snippet && r.snippet.length > 0)
              ? r.snippet
              : (r.raw_content||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,' ').trim().slice(0,120);
            return '<div style="padding:6px 8px;border-bottom:1px solid #2a3a3a;cursor:pointer;" ' +
              'onclick="window.open(\'' + (r.session_url||'#') + '\');">' +
              '<div style="font-size:10px;color:#67e8f9;">' + (r.platform||'') + ' · ' + (r.created_at||'').slice(0,10) + '</div>' +
              '<div style="margin-top:3px;font-size:11px;color:#e2e8f0;line-height:1.4;">' + (snippetHtml||'(내용 없음)') + '</div>' +
              '</div>';
          }).join('') || '<div style="color:#666;padding:6px;">결과 없음</div>';
        }).catch(function(e) {
          resultsEl.innerHTML = '<div style="color:#f87171;padding:6px;">검색 오류: ' + e.message + '</div>';
        });
      } else {
        resultsEl.innerHTML = '<div style="color:#666;padding:6px;">검색 인덱스 로딩 중...</div>';
      }
    });
  };


  CK.lastSavedHash = null;

  /**
   * 새 턴 감지 후 IndexedDB 저장
   * @param {boolean} force - 강제 저장 여부
   */
  CK.saveChunkIfChanged = function(force) {
    if (CK.shouldSkipConversation()) return;
    var turns = CK.extractTurns();
    if (!turns || turns.length === 0) return;
    var hash = CK.computeTurnHash(turns);
    if (!force && hash === CK.lastSavedHash) return;
    CK.lastSavedHash = hash;
    var chatId = CK.getChatId();
    var chunk = {
      chunk_id:    CK.hashText(chatId),  // session당 1개 upsert
      session_id:  chatId,
      session_url: location.href,
      platform:    CK.getPlatformKey(),
      turn_start:  0,
      turn_end:    turns.length - 1,
      raw_content: CK.formatChunk(turns),
      raw_ngrams:  CK.generateKoreanNgrams ? CK.generateKoreanNgrams(CK.formatChunk(turns)).join(' ') : '',
      created_at:  new Date().toISOString(),
    };
    var store = CK.IndexedDBStore;
    store.saveChunk(chunk).then(function() {
      if (CK.CONFIG.API_KEY) CK.syncChunkToWorker(chunk);
      CK.updateStatus && CK.updateStatus('저장됨');
      if (window._ckEngine) window._ckEngine.add(chunk);
    }).catch(function(e) { console.error('[CK] 저장 실패', e); });
  };


  /**
   * Mode B: 청크를 Cloudflare Worker(D1)로 동기화
   * API_KEY 없으면 스킵 (Mode A 전용 사용자)
   */
  CK.syncChunkToWorker = function(chunk) {
    var url = CK.CONFIG.WORKER_URL;
    var key = CK.CONFIG.API_KEY;
    if (!url || !key) return Promise.resolve(null);

    var payload = {
      chunk_id:   chunk.chunk_id,
      session_id: chunk.session_id,
      session_url: chunk.session_url || chunk.url || '',
      platform:   chunk.platform || '',
      title:      chunk.title || '',
      raw_content: chunk.raw_content || '',
      raw_ngrams:  chunk.raw_ngrams || '',
      created_at:  chunk.created_at || new Date().toISOString(),
      turn_count:  chunk.turn_count || 0
    };

    return fetch(url + '/api/chunk/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.ok) {
        console.log('[CK] D1 동기화 완료:', chunk.chunk_id);
      } else {
        console.warn('[CK] D1 동기화 실패:', data.error || data);
      }
      return data;
    })
    .catch(function(err) {
      console.warn('[CK] D1 동기화 오류:', err.message);
    });
  };

  function init() {
    console.log('[CK-DEBUG] init() called');
    console.log('[CK-DEBUG] CK.LocalSearch:', typeof CK.LocalSearch);
    console.log('[CK-DEBUG] CK.IndexedDBStore:', typeof CK.IndexedDBStore);
    console.log('[CK-DEBUG] CK.observer:', typeof CK.observer);
    // ESC 키: 검색 패널 닫기 (document 레벨, 1회만 등록)
    // [CK] ESC 핸들러 등록 완료
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var panel = document.getElementById('ck-search-panel');
        if (panel && panel.style.display !== 'none') {
          panel.style.display = 'none';
          e.stopPropagation();
        }
      }
    }, true);

    var target = document.querySelector('.conversation-content')
      || document.querySelector('.chat-wrapper')
      || document.body;

    CK.observer.observe(target, { childList: true, subtree: true });

    var bodyObserver = new MutationObserver(function() { CK.ensureUI(); });
    bodyObserver.observe(document.body, { childList: true });

    CK.ensureUI();

    // 검색 엔진 초기화 + 기존 청크 인덱스 로드
    if (CK.LocalSearch && CK.IndexedDBStore) {
      CK.LocalSearch.init().then(function() {
        window._ckEngine = CK.LocalSearch;
        console.log('[CK] 검색 인덱스 초기화 완료');
      }).catch(function(e) {
        console.error('[CK] 검색 인덱스 초기화 실패', e);
      });
    }

    // keepalive ping
    setInterval(function() {
      try { chrome.runtime.sendMessage({type: 'ping'}, function() { if (chrome.runtime.lastError) {} }); } catch(e) {}
    }, 20000);

    console.log('[CK] Context Keeper v0.9 active (modular + autorun + hash-detect)');
    CK.checkForNewTurns();

    var lastCheckedUrl = '';
    setInterval(function() {
      var currentUrl = window.location.href;
      if (currentUrl !== lastCheckedUrl && currentUrl.indexOf('id=') > -1) {
        lastCheckedUrl = currentUrl;
        // setTimeout(CK.checkPreviousContext, 2000); // 자동 프로젝트 맥락 표시 비활성화
      }
    }, 3000);
  }

  function start() {
    CK.loadSettings(function() {
      init();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
