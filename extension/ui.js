/**
 * AIKeep24-Lite - UI
 * 원본 AIKeep24 ui.js 구조 그대로.
 * 제거: INJ, BRW, 벡터검색, D1 API 호출
 * 추가: SAVE, SEARCH 버튼 + 검색 패널
 */
(function() {
  var CKL = window.CKL;

  CKL.updateStatus = function(msg) {
    var el = document.getElementById('ckl-badge');
    if (el) { el.innerText = msg; el.style.display = msg ? 'block' : 'none'; }
    if (msg) console.log('[CKL] ' + msg);
  };

  /* 원본과 동일한 setRunBtnState 패턴 */
  CKL.setSaveBtnState = function(running) {
    var btn = document.getElementById('ckl-save-btn');
    if (!btn) return;
    if (running) {
      btn.disabled = true;
      btn.style.background = '#666';
      btn.style.cursor = 'not-allowed';
      btn.innerText = '저장중...';
    } else {
      btn.disabled = false;
      btn.style.background = '#86efac';
      btn.style.cursor = 'pointer';
      btn.innerText = 'SAVE';
    }
  };

  CKL.createUI = function() {
    /* 원본과 동일한 패널 구조 */
    var panel = document.createElement('div');
    panel.id = 'ckl-panel';
    panel.style.cssText = 'position:fixed;bottom:120px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:flex-end;padding:2px 0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

    var badge = document.createElement('div');
    badge.id = 'ckl-badge';
    badge.style.cssText = 'display:none;background:rgba(20,25,40,0.92);color:#b0b8c8;font-size:11px;padding:8px 12px;border-radius:6px;max-width:350px;line-height:1.4;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.08);font-family:monospace;white-space:pre-wrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);';

    var btnBox = document.createElement('div');
    btnBox.style.cssText = 'display:flex;gap:4px;align-items:center;';

    /* 원본과 완전히 동일한 버튼 스타일 */
    var btnStyle = 'border:1.5px solid #0f172a;box-shadow:2px 2px 0px #0f172a;border-radius:3px;padding:2px 10px;font-size:9px;font-weight:700;cursor:pointer;transition:all 0.15s ease;text-transform:uppercase;letter-spacing:0.5px;line-height:1.4;';

    /* ON/OFF — 원본과 동일 */
    var btnToggle = document.createElement('button');
    btnToggle.id = 'ckl-toggle-btn';
    btnToggle.innerText = 'ON';
    btnToggle.style.cssText = 'background:#86efac;color:#0f172a;' + btnStyle;
    btnToggle.onclick = function() {
      CKL.enabled = !CKL.enabled;
      btnToggle.innerText = CKL.enabled ? 'ON' : 'OFF';
      btnToggle.style.background = CKL.enabled ? '#86efac' : '#f87171';
      CKL.updateStatus(CKL.enabled ? 'CKL: Enabled' : 'CKL: Disabled');
      if (!CKL.enabled) {
        if (CKL.autoSaveTimer) { clearTimeout(CKL.autoSaveTimer); CKL.autoSaveTimer = null; }
        if (CKL.isRunning) { CKL.isRunning = false; CKL.setSaveBtnState(false); }
      }
    };
    btnBox.appendChild(btnToggle);

    /* SAVE — 원본 RUN 패턴 그대로 */
    var btnSave = document.createElement('button');
    btnSave.id = 'ckl-save-btn';
    btnSave.innerText = 'SAVE';
    btnSave.style.cssText = 'background:#86efac;color:#0f172a;' + btnStyle;
    var holdTimer = null;
    btnSave.onmousedown = function() {
      holdTimer = setTimeout(function() {
        holdTimer = 'held';
        CKL.updateStatus('CKL: Reloading...');
        chrome.runtime.sendMessage({type: 'reload_extension'}, function() {
          CKL.updateStatus('CKL: Reloaded! Refreshing...');
          setTimeout(function() { location.reload(); }, 1000);
        });
      }, 2000);
    };
    btnSave.onmouseup = function() {
      if (holdTimer === 'held') { holdTimer = null; return; }
      clearTimeout(holdTimer); holdTimer = null;
      badge.style.display = 'block';
      CKL.saveChunkIfChanged();
    };
    btnSave.onmouseleave = function() {
      if (holdTimer && holdTimer !== 'held') { clearTimeout(holdTimer); holdTimer = null; }
    };
    btnBox.appendChild(btnSave);

    /* SNAP — 원본과 동일 */
    var btnSnap = document.createElement('button');
    btnSnap.id = 'ckl-snap-btn';
    btnSnap.innerText = 'SNAP';
    btnSnap.style.cssText = 'background:#fbbf24;color:#0f172a;' + btnStyle;
    btnSnap.onclick = function() {
      var allTurns = CKL.extractTurns();
      if (allTurns.length < 2) {
        CKL.updateStatus('SNAP: Not enough turns');
        setTimeout(function() { badge.style.display = 'none'; }, 3000);
        return;
      }
      var recentTurns = allTurns.slice(-CKL.CONFIG.SNAP_TURNS);
      var snapText = recentTurns.map(function(t) {
        return '[' + t.role.toUpperCase() + ']\n' + t.text;
      }).join('\n\n');
      navigator.clipboard.writeText(snapText).then(function() {
        CKL.updateStatus('SNAP copied! (' + recentTurns.length + ' turns) Cmd+V');
        setTimeout(function() { badge.style.display = 'none'; }, 4000);
      });
    };
    btnBox.appendChild(btnSnap);

    /* SEARCH */
    var btnSearch = document.createElement('button');
    btnSearch.id = 'ckl-search-btn';
    btnSearch.innerText = 'SEARCH';
    btnSearch.style.cssText = 'background:#c4a7e7;color:#0f172a;' + btnStyle;

    var searchPanel = _buildSearchPanel();
    btnSearch.onclick = function() {
      var visible = searchPanel.style.display !== 'none';
      searchPanel.style.display = visible ? 'none' : 'block';
      if (!visible) setTimeout(function() {
        var inp = document.getElementById('ckl-search-input');
        if (inp) inp.focus();
      }, 50);
    };
    btnBox.appendChild(btnSearch);

    panel.appendChild(btnBox);
    panel.appendChild(searchPanel);
    panel.appendChild(badge);
    document.body.appendChild(panel);
  };

  /* ── 검색 패널 ── */
  function _buildSearchPanel() {
    var panel = document.createElement('div');
    panel.id = 'ckl-search-panel';
    panel.style.cssText = 'display:none;background:rgba(20,25,40,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:6px;max-height:380px;overflow-y:auto;min-width:300px;backdrop-filter:blur(8px);';

    /* 입력 행 */
    var inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;gap:4px;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:4px;';

    var input = document.createElement('input');
    input.id = 'ckl-search-input';
    input.type = 'text';
    input.placeholder = '검색어 입력... (한국어 지원)';
    input.style.cssText = 'flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e4e4e7;font-size:11px;padding:5px 8px;outline:none;';

    var goBtn = document.createElement('button');
    goBtn.textContent = '검색';
    goBtn.style.cssText = 'background:#7c83ff;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:10px;font-weight:700;';
    goBtn.onclick = function() { _runSearch(input.value); };
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') _runSearch(input.value); });

    inputRow.appendChild(input);
    inputRow.appendChild(goBtn);

    /* 필터 행 */
    var filterRow = document.createElement('div');
    filterRow.style.cssText = 'display:flex;gap:4px;padding:2px;margin-bottom:4px;flex-wrap:wrap;';

    var platformSel = document.createElement('select');
    platformSel.id = 'ckl-filter-platform';
    platformSel.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#ccc;border-radius:4px;padding:2px 4px;font-size:10px;';
    [['', '전체'], ['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['genspark', 'Genspark']].forEach(function(o) {
      var opt = document.createElement('option');
      opt.value = o[0]; opt.textContent = o[1];
      platformSel.appendChild(opt);
    });
    filterRow.appendChild(platformSel);

    /* 결과 영역 */
    var results = document.createElement('div');
    results.id = 'ckl-results';
    results.style.cssText = 'color:#888;font-size:11px;padding:4px;';

    panel.appendChild(inputRow);
    panel.appendChild(filterRow);
    panel.appendChild(results);
    return panel;
  }

  function _runSearch(query) {
    query = (query || '').trim();
    if (!query) return;
    var results = document.getElementById('ckl-results');
    var platform = document.getElementById('ckl-filter-platform').value;
    results.innerHTML = '<div style="color:#888;padding:8px;">검색 중...</div>';

    var opts = { limit: 20 };
    if (platform) opts.platform = platform;

    CKL.LocalSearch.search(query, opts).then(function(hits) {
      if (!hits.length) { results.innerHTML = '<div style="color:#888;padding:8px;">결과 없음</div>'; return; }
      results.innerHTML = '<div style="color:#86efac;font-size:10px;padding:2px 4px;">' + hits.length + '건</div>';
      hits.forEach(function(hit) { results.appendChild(_resultCard(hit)); });
    }).catch(function(e) {
      results.innerHTML = '<div style="color:#f87171;padding:8px;">오류: ' + e.message + '</div>';
    });
  }

  function _resultCard(hit) {
    var card = document.createElement('div');
    card.style.cssText = 'padding:6px 4px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;';
    card.onmouseenter = function() { card.style.background = 'rgba(124,131,255,0.08)'; };
    card.onmouseleave = function() { card.style.background = ''; };

    var platformLabel = {chatgpt:'ChatGPT', claude:'Claude', genspark:'Genspark'}[hit.platform] || hit.platform;
    var date = hit.created_at ? hit.created_at.slice(0,10) : '';

    var header = '<span style="background:rgba(124,131,255,0.2);color:#a5b4fc;font-size:9px;padding:1px 5px;border-radius:8px;font-weight:700;">' + platformLabel + '</span>'
               + '<span style="color:#666;font-size:9px;margin-left:6px;">' + date + '</span>';

    var snippet = '<div style="color:#ccc;font-size:10px;line-height:1.5;margin:3px 0;max-height:48px;overflow:hidden;">' + (hit.snippet || '') + '</div>';

    var url = '<a href="' + hit.session_url + '" target="_blank" style="color:#5599ff;font-size:9px;text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + hit.session_url + '</a>';

    card.innerHTML = header + snippet + url;
    return card;
  }

  /* 원본과 동일: ensureUI는 observer.js에서 호출 */

})();
