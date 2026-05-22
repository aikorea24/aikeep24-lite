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


  /** BROWSE: 세션 브라우저 패널 토글 */
  CK.openBrowsePanel = function() {
    var panel = document.getElementById('ck-browse-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      if (panel.style.display !== 'none') CK._loadBrowseSessions(panel);
      return;
    }

    var bp = document.createElement('div');
    bp.id = 'ck-browse-panel';
    bp.style.cssText = 'position:fixed;bottom:60px;right:10px;z-index:999999;' +
      'background:rgba(20,25,40,0.97);border:1px solid rgba(255,255,255,0.15);' +
      'border-radius:12px;padding:12px;width:320px;color:#fff;font-size:13px;' +
      'max-height:420px;display:flex;flex-direction:column;';
    bp.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<span style="font-weight:bold;">📚 Session Browser</span>' +
        '<select id="ck-brw-filter" style="background:#1e2330;color:#94a3b8;border:1px solid #444;' +
          'border-radius:4px;font-size:11px;padding:2px 4px;">' +
          '<option value="">All</option>' +
          '<option value="chatgpt">ChatGPT</option>' +
          '<option value="claude">Claude</option>' +
          '<option value="genspark">Genspark</option>' +
        '</select>' +
      '</div>' +
      '<div id="ck-brw-list" style="overflow-y:auto;flex:1;"></div>';
    document.body.appendChild(bp);

    document.getElementById('ck-brw-filter').addEventListener('change', function() {
      CK._loadBrowseSessions(bp);
    });
    CK._loadBrowseSessions(bp);
  };

  /** 세션 브라우저 내부: IndexedDB에서 세션 목록 로드 (핀 기능 포함) */
  CK._loadBrowseSessions = function(panel) {
    var listEl = document.getElementById('ck-brw-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:#666;padding:6px;font-size:11px;">불러오는 중...</div>';

    var filterPlatform = (document.getElementById('ck-brw-filter') || {}).value || '';

    chrome.storage.local.get(['ck_pinned'], function(data) {
      var pinned = data.ck_pinned || [];

      CK.IndexedDBStore.getAllChunks().then(function(chunks) {
        var sessions = chunks
          .filter(function(c) { return !filterPlatform || c.platform === filterPlatform; })
          .sort(function(a, b) { return a.created_at > b.created_at ? -1 : 1; });

        if (sessions.length === 0) {
          listEl.innerHTML = '<div style="color:#666;padding:6px;font-size:11px;">저장된 세션 없음</div>';
          return;
        }

        var now = new Date();
        var groups = { pinned: [], week: [], month: [], older: [] };
        sessions.forEach(function(s) {
          if (pinned.indexOf(s.chunk_id) > -1) { groups.pinned.push(s); return; }
          var diff = (now - new Date(s.created_at)) / 86400000;
          if (diff <= 7)       groups.week.push(s);
          else if (diff <= 30) groups.month.push(s);
          else                 groups.older.push(s);
        });

        var platIcon = { chatgpt: '\u{1F916}', claude: '\u{1F7E0}', genspark: '\u{1F7E2}' };

        function renderGroup(label, items) {
          if (!items.length) return '';
          var html = '<div style="font-size:10px;color:#475569;padding:4px 6px 2px;font-weight:700;' +
            'text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>';
          items.forEach(function(s) {
            var isPinned = pinned.indexOf(s.chunk_id) > -1;
            var icon  = platIcon[s.platform] || '\u{1F4AC}';
            var title = (s.raw_content || '').replace(/[\n\r]+/g, ' ').trim().slice(0, 45)
                        || s.session_id.slice(0, 12);
            var date  = (s.created_at || '').slice(0, 10);
            var safeTitle = title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            html += '<div class="ck-brw-item" data-cid="' + s.chunk_id + '" ' +
              'data-url="' + (s.session_url || '#') + '" ' +
              'style="padding:6px 8px;border-bottom:1px solid #1e2a3a;cursor:pointer;' +
              'border-radius:4px;display:flex;justify-content:space-between;align-items:flex-start;">' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:10px;color:#67e8f9;">' + icon + ' ' + (s.platform||'') + ' \u00b7 ' + date + '</div>' +
                '<div style="font-size:11px;color:#e2e8f0;margin-top:2px;line-height:1.4;' +
                  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeTitle + '</div>' +
              '</div>' +
              '<button class="ck-pin-btn" data-cid="' + s.chunk_id + '" ' +
                'style="background:none;border:none;cursor:pointer;font-size:13px;' +
                'padding:0 0 0 6px;color:' + (isPinned ? '#ffd166' : '#475569') + ';flex-shrink:0;line-height:1;">' +
                (isPinned ? '\u{1F4CC}' : '\u{1F4CD}') +
              '</button>' +
            '</div>';
          });
          return html;
        }

        listEl.innerHTML =
          renderGroup('\u{1F4CC} \uace0\uc815\ub428', groups.pinned) +
          renderGroup('\u{1F4C5} \uc774\ubc88 \uc8fc', groups.week) +
          renderGroup('\u{1F4C5} \uc774\ubc88 \ub2ec', groups.month) +
          renderGroup('\u{1F4C5} \uc774\uc804', groups.older);

        listEl.querySelectorAll('.ck-brw-item').forEach(function(el) {
          el.addEventListener('click', function(e) {
            if (e.target.classList.contains('ck-pin-btn')) return;
            var url = el.getAttribute('data-url');
            if (url && url !== '#') window.open(url, '_blank');
          });
          el.addEventListener('mouseenter', function() { el.style.background = 'rgba(103,232,249,0.08)'; });
          el.addEventListener('mouseleave', function() { el.style.background = ''; });
        });

        listEl.querySelectorAll('.ck-pin-btn').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var cid = btn.getAttribute('data-cid');
            chrome.storage.local.get(['ck_pinned'], function(d) {
              var pins = d.ck_pinned || [];
              var idx  = pins.indexOf(cid);
              if (idx > -1) pins.splice(idx, 1);
              else          pins.unshift(cid);
              chrome.storage.local.set({ ck_pinned: pins }, function() {
                CK._loadBrowseSessions(panel);
              });
            });
          });
        });

      }).catch(function(e) {
        listEl.innerHTML = '<div style="color:#f87171;padding:6px;font-size:11px;">\uc624\ub958: ' + e.message + '</div>';
      });
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
      // ESC: 열린 패널 닫기 (Search 또는 Browse)
      if (e.key === 'Escape') {
        var sp = document.getElementById('ck-search-panel');
        var bp = document.getElementById('ck-browse-panel');
        if (sp && sp.style.display !== 'none') { sp.style.display = 'none'; e.stopPropagation(); return; }
        if (bp && bp.style.display !== 'none') { bp.style.display = 'none'; e.stopPropagation(); return; }
      }
      // Cmd+K (Mac) / Ctrl+K (Win): Search 패널 열기
      if (e.key === 'K' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        CK.openSearchPanel && CK.openSearchPanel();
        var inp = document.getElementById('ck-search-input');
        if (inp) { setTimeout(function(){ inp.focus(); }, 50); }
      }
    }, true);

    var target = document.querySelector('.conversation-content')
      || document.querySelector('.chat-wrapper')
      || document.body;

    CK.observer.observe(target, { childList: true, subtree: true });

    var bodyObserver = new MutationObserver(function() { CK.ensureUI(); });
    bodyObserver.observe(document.body, { childList: true });

    CK.ensureUI();

    // 검색 엔진 초기화: API_KEY 있으면 CloudSearch(Mode B), 없으면 LocalSearch(Mode A)
    if (CK.CONFIG.API_KEY && CK.CloudSearch) {
      CK.CloudSearch.init().then(function() {
        window._ckEngine = CK.CloudSearch;
        console.log('[CK] 검색 엔진: CloudSearch (Mode B)');
      });
      // LocalSearch도 병렬 초기화 (fallback용)
      if (CK.LocalSearch && CK.IndexedDBStore) {
        CK.LocalSearch.init().catch(function(e) {
          console.warn('[CK] LocalSearch 초기화 실패:', e);
        });
      }
    } else if (CK.LocalSearch && CK.IndexedDBStore) {
      CK.LocalSearch.init().then(function() {
        window._ckEngine = CK.LocalSearch;
        console.log('[CK] 검색 엔진: LocalSearch (Mode A)');
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
