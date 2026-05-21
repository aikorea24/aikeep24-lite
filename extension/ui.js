/**
 * AIKeep24-Lite - UI (검색 패널 완성)
 *
 * 포함 기능:
 *   - 하단 고정 컨트롤 바 (SAVE / SNAP / SEARCH 버튼)
 *   - 검색 패널: 입력창 + 메타 필터(플랫폼, 날짜) + 결과 카드
 *   - 결과 카드: 플랫폼 배지 + 날짜 + 스니펫 하이라이트 + URL 클릭
 */
(function() {
  'use strict';

  var CKL = window.CKL;

  /* ───────────────────────── 컨트롤 바 ───────────────────────── */

  CKL.createUI = function() {
    if (document.getElementById('ckl-panel')) return;
    _injectStyles();

    /* 컨트롤 바 */
    var bar = _el('div', { id: 'ckl-panel' });

    var label = _el('span', { id: 'ckl-label', textContent: 'CKL' });

    var saveBtn = _btn('SAVE', '#2d6a4f', '#74c69d', function() {
      if (!CKL.isRunning) CKL.saveChunkIfChanged();
    });

    var snapBtn = _btn('SNAP', '#1d3557', '#a8dadc', function() {
      CKL.snapToClipboard();
    });

    var searchBtn = _btn('SEARCH', '#3d2b69', '#c77dff', function() {
      _toggleSearchPanel();
    });

    var exportBtn = _btn('⬇', '#2a2a1a', '#ffd166', function() {
      _showExportMenu(exportBtn);
    });
    exportBtn.title = '대화 내보내기 (JSON / Markdown)';

    var countBadge = _el('span', { id: 'ckl-count', title: '저장된 청크 수' });
    countBadge.style.cssText = 'color:#555;font-size:10px;min-width:24px;text-align:center';

    var status = _el('span', { id: 'ckl-status' });

    [label, saveBtn, snapBtn, searchBtn, exportBtn, countBadge, status].forEach(function(n) { bar.appendChild(n); });

    // 청크 카운트 초기화 + 주기적 갱신 (30초)
    _refreshCount();
    setInterval(_refreshCount, 30000);
    document.body.appendChild(bar);

    /* 검색 패널 */
    _buildSearchPanel();

    console.log('[CKL] UI created');
  };

  /* ───────────────────────── 검색 패널 ───────────────────────── */

  function _buildSearchPanel() {
    if (document.getElementById('ckl-search-panel')) return;

    var panel = _el('div', { id: 'ckl-search-panel' });

    /* 헤더 */
    var header = _el('div', { id: 'ckl-search-header' });
    var title  = _el('span', { textContent: '🔍 대화 검색', id: 'ckl-search-title' });
    var closeBtn = _el('button', { textContent: '✕', id: 'ckl-search-close' });
    closeBtn.onclick = function() { panel.style.display = 'none'; };
    header.appendChild(title);
    header.appendChild(closeBtn);

    /* 검색 입력 */
    var inputRow = _el('div', { id: 'ckl-input-row' });
    var input = _el('input', {
      id: 'ckl-search-input',
      type: 'text',
      placeholder: '검색어 입력... (한국어 지원)'
    });
    var goBtn = _btn('검색', '#3d2b69', '#c77dff', function() { _runSearch(); });
    goBtn.id = 'ckl-go-btn';
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') _runSearch();
    });
    inputRow.appendChild(input);
    inputRow.appendChild(goBtn);

    /* 필터 행 */
    var filterRow = _el('div', { id: 'ckl-filter-row' });

    var platformSel = _el('select', { id: 'ckl-filter-platform' });
    [['', '전체 플랫폼'], ['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['genspark', 'Genspark']]
      .forEach(function(opt) {
        var o = _el('option', { value: opt[0], textContent: opt[1] });
        platformSel.appendChild(o);
      });

    var dateFrom = _el('input', { id: 'ckl-filter-from', type: 'date' });
    var dateTo   = _el('input', { id: 'ckl-filter-to',   type: 'date' });
    var dateLabel1 = _el('span', { textContent: '시작', className: 'ckl-filter-label' });
    var dateLabel2 = _el('span', { textContent: '종료', className: 'ckl-filter-label' });

    [platformSel, dateLabel1, dateFrom, dateLabel2, dateTo].forEach(function(n) {
      filterRow.appendChild(n);
    });

    /* 결과 카운트 */
    var countLine = _el('div', { id: 'ckl-result-count' });

    /* 결과 목록 */
    var results = _el('div', { id: 'ckl-results' });

    [header, inputRow, filterRow, countLine, results].forEach(function(n) { panel.appendChild(n); });
    document.body.appendChild(panel);
  }

  function _toggleSearchPanel() {
    var panel = document.getElementById('ckl-search-panel');
    if (!panel) { _buildSearchPanel(); panel = document.getElementById('ckl-search-panel'); }
    var visible = panel.style.display !== 'none' && panel.style.display !== '';
    panel.style.display = visible ? 'none' : 'flex';
    if (!visible) {
      setTimeout(function() {
        var inp = document.getElementById('ckl-search-input');
        if (inp) inp.focus();
      }, 50);
    }
  }

  function _runSearch() {
    var query    = (document.getElementById('ckl-search-input').value || '').trim();
    var platform = document.getElementById('ckl-filter-platform').value;
    var dateFrom = document.getElementById('ckl-filter-from').value;
    var dateTo   = document.getElementById('ckl-filter-to').value;
    var results  = document.getElementById('ckl-results');
    var countLine = document.getElementById('ckl-result-count');

    if (!query) return;

    results.innerHTML = '<div class="ckl-loading">검색 중...</div>';
    countLine.textContent = '';

    var opts = { limit: 20 };
    if (platform) opts.platform = platform;
    if (dateFrom) opts.dateFrom = dateFrom + 'T00:00:00.000Z';
    if (dateTo)   opts.dateTo   = dateTo   + 'T23:59:59.999Z';

    CKL.getStorageMode().then(function(mode) {
      var engine = mode === 'cloud' ? CKL.CloudSearch : CKL.LocalSearch;
      return engine.search(query, opts);
    }).then(function(hits) {
      results.innerHTML = '';

      if (hits.length === 0) {
        results.innerHTML = '<div class="ckl-no-result">검색 결과 없음</div>';
        countLine.textContent = '';
        return;
      }

      countLine.textContent = hits.length + '건 발견';
      hits.forEach(function(hit) { results.appendChild(_resultCard(hit)); });

    }).catch(function(err) {
      console.error('[CKL] Search error', err);
      results.innerHTML = '<div class="ckl-no-result">검색 오류: ' + err.message + '</div>';
    });
  }

  /**
   * 검색 결과 카드 DOM 요소를 생성한다.
   * @param {Object} hit - SearchInterface 결과 스키마
   * @returns {HTMLElement}
   */
  function _resultCard(hit) {
    var card = _el('div', { className: 'ckl-card' });

    /* 헤더: 플랫폼 배지 + 날짜 */
    var cardHeader = _el('div', { className: 'ckl-card-header' });
    var badge = _el('span', { textContent: _platformLabel(hit.platform), className: 'ckl-badge ckl-badge-' + hit.platform });
    var date  = _el('span', { textContent: _formatDate(hit.created_at), className: 'ckl-date' });
    cardHeader.appendChild(badge);
    cardHeader.appendChild(date);

    /* 스니펫 */
    var snippet = _el('div', { className: 'ckl-snippet' });
    snippet.innerHTML = hit.snippet || '(내용 없음)';

    /* URL 링크 */
    var link = _el('a', {
      textContent: hit.session_url,
      href: hit.session_url,
      target: '_blank',
      className: 'ckl-url'
    });

    card.appendChild(cardHeader);
    card.appendChild(snippet);
    card.appendChild(link);
    return card;
  }

  /* ───────────────────────── 헬퍼 ───────────────────────── */

  function _platformLabel(p) {
    return { chatgpt: 'ChatGPT', claude: 'Claude', genspark: 'Genspark' }[p] || p || '?';
  }

  function _formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.getFullYear() + '.' +
        String(d.getMonth() + 1).padStart(2, '0') + '.' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
    } catch(e) { return iso; }
  }

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function(k) { el[k] = props[k]; });
    return el;
  }

  function _btn(text, bg, color, onClick) {
    var btn = _el('button', { textContent: text });
    btn.style.cssText = 'background:' + bg + ';color:' + color + ';border:none;border-radius:4px;' +
      'padding:4px 10px;cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.3px;white-space:nowrap';
    btn.onclick = onClick;
    return btn;
  }

  function _injectStyles() {
    if (document.getElementById('ckl-styles')) return;
    var s = document.createElement('style');
    s.id = 'ckl-styles';
    s.textContent = [
      '#ckl-panel{position:fixed;bottom:16px;right:16px;z-index:2147483647;',
        'background:#1a1a2e;border:1px solid #444;border-radius:8px;',
        'padding:7px 12px;display:flex;align-items:center;gap:8px;',
        'font-family:system-ui,sans-serif;font-size:12px;color:#eee;',
        'box-shadow:0 2px 16px rgba(0,0,0,0.6)}',
      '#ckl-label{color:#7c83ff;font-weight:700;letter-spacing:0.5px}',
      '#ckl-status{color:#aaa;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

      '#ckl-search-panel{position:fixed;bottom:60px;right:16px;z-index:2147483646;',
        'background:#12121f;border:1px solid #444;border-radius:10px;',
        'width:420px;max-height:600px;display:flex;flex-direction:column;',
        'font-family:system-ui,sans-serif;font-size:13px;color:#eee;',
        'box-shadow:0 4px 24px rgba(0,0,0,0.7);overflow:hidden}',

      '#ckl-search-header{display:flex;align-items:center;justify-content:space-between;',
        'padding:10px 14px;border-bottom:1px solid #333;background:#1a1a2e}',
      '#ckl-search-title{font-weight:700;font-size:14px}',
      '#ckl-search-close{background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:0 4px}',
      '#ckl-search-close:hover{color:#fff}',

      '#ckl-input-row{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid #2a2a3e}',
      '#ckl-search-input{flex:1;background:#0d0d1a;border:1px solid #444;border-radius:5px;',
        'color:#eee;padding:6px 10px;font-size:13px;outline:none}',
      '#ckl-search-input:focus{border-color:#7c83ff}',

      '#ckl-filter-row{display:flex;align-items:center;gap:6px;padding:7px 12px;',
        'border-bottom:1px solid #2a2a3e;flex-wrap:wrap}',
      '#ckl-filter-platform{background:#0d0d1a;border:1px solid #333;color:#ccc;',
        'border-radius:4px;padding:3px 6px;font-size:12px}',
      '#ckl-filter-from,#ckl-filter-to{background:#0d0d1a;border:1px solid #333;color:#ccc;',
        'border-radius:4px;padding:3px 6px;font-size:12px;width:120px}',
      '.ckl-filter-label{font-size:11px;color:#888}',

      '#ckl-result-count{padding:5px 14px;font-size:11px;color:#888;background:#161626}',
      '#ckl-results{overflow-y:auto;flex:1;padding:8px}',

      '.ckl-card{background:#1a1a2e;border:1px solid #2a2a40;border-radius:7px;',
        'padding:10px 12px;margin-bottom:8px;cursor:default}',
      '.ckl-card:hover{border-color:#7c83ff}',
      '.ckl-card-header{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      '.ckl-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;letter-spacing:0.3px}',
      '.ckl-badge-chatgpt{background:#10a37f22;color:#10a37f}',
      '.ckl-badge-claude{background:#cc785122;color:#cc7851}',
      '.ckl-badge-genspark{background:#7c83ff22;color:#7c83ff}',
      '.ckl-date{font-size:11px;color:#888}',
      '.ckl-snippet{font-size:12px;color:#ccc;line-height:1.6;margin-bottom:7px;',
        'max-height:80px;overflow:hidden}',
      '.ckl-url{display:block;font-size:11px;color:#5599ff;text-decoration:none;',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ckl-url:hover{text-decoration:underline}',
      '.ckl-loading{color:#888;padding:20px;text-align:center}',
      '.ckl-no-result{color:#666;padding:20px;text-align:center;font-size:12px}',
      '#ckl-export-menu div:hover{background:#2a2a40}'
    ].join('');
    document.head.appendChild(s);
  }

})();
