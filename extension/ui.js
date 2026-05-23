/**
 * AIKeep24 - UI (버튼, 배지, BRW 패널, 탭 토글)
 */
(function() {
  var CK = window.CK;

  CK.updateBadge = function(msg) {
    var el = document.getElementById('ck-badge');
    if (el) { el.innerText = msg; el.style.display = 'block'; }
  };

  CK.setRunBtnState = function(running) {
    var btn = document.getElementById('ck-run-btn');
    if (!btn) return;
    if (running) {
      btn.disabled = true;
      btn.style.background = '#666';
      btn.style.cursor = 'not-allowed';
      btn.innerText = 'Running...';
    } else {
      btn.disabled = false;
      btn.style.background = '#86efac';
      btn.style.cursor = 'pointer';
      btn.innerText = 'RUN';
    }
  };

  CK.createUI = function() {
    var panel = document.createElement('div');
    panel.id = 'ck-panel';
    panel.style.cssText = 'position:fixed;bottom:120px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:flex-end;padding:2px 0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

    var badge = document.createElement('div');
    badge.id = 'ck-badge';
    badge.style.cssText = 'display:none;background:rgba(10,30,30,0.92);color:#b0b8c8;font-size:11px;padding:8px 12px;border-radius:6px;max-width:350px;line-height:1.4;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.08);font-family:monospace;white-space:pre-wrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);';

    var btnBox = document.createElement('div');
    btnBox.style.cssText = 'display:flex;gap:4px;align-items:center;';

    var btnStyle = 'border:1.5px solid #0f172a;box-shadow:2px 2px 0px #0f172a;border-radius:3px;padding:2px 10px;font-size:9px;font-weight:700;cursor:pointer;transition:all 0.15s ease;text-transform:uppercase;letter-spacing:0.5px;line-height:1.4;';

    // === ON/OFF 토글 ===
    var btnToggle = document.createElement('button');
    btnToggle.id = 'ck-toggle-btn';
    btnToggle.innerText = 'ON';
    btnToggle.style.cssText = 'background:#67e8f9;color:#0f172a;' + btnStyle;
    btnToggle.onclick = function() {
      CK.enabled = !CK.enabled;
      btnToggle.innerText = CK.enabled ? 'ON' : 'OFF';
      btnToggle.style.background = CK.enabled ? '#86efac' : '#f87171';
      CK.updateBadge(CK.enabled ? 'CK: Enabled' : 'CK: Disabled (RUN/AutoRun blocked)');
      if (!CK.enabled) {
        if (CK.autoRunTimer) {
          clearTimeout(CK.autoRunTimer);
          CK.autoRunTimer = null;
        }
        // Running 중 OFF → 상태 리셋하여 다시 ON 시 RUN 가능
        if (CK.isRunning) {
          CK.isRunning = false;
          CK.setRunBtnState(false);
        }
      }
    };
    btnBox.appendChild(btnToggle);

    // === RUN 버튼 ===
        var btnSave = document.createElement('button');
    btnSave.id = 'ck-save-btn';
    btnSave.innerText = 'SAVE';
    btnSave.style.cssText = 'background:#34d399;color:#0f172a;' + btnStyle;
    btnSave.onclick = function() {
      CK.saveChunkIfChanged(true);
      btnSave.innerText = '✓';
      setTimeout(function(){ btnSave.innerText = 'SAVE'; }, 1500);
    };
    btnBox.appendChild(btnSave);

    // === INJ 버튼 ===
    

    // === SNAP 버튼 ===
    var btnSnap = document.createElement('button');
    btnSnap.id = 'ck-snap-btn';
    btnSnap.innerText = 'SNAP';
    btnSnap.style.cssText = 'background:#fb923c;color:#0f172a;' + btnStyle;
    btnSnap.onclick = function() {
      var allTurns = CK.extractTurns ? CK.extractTurns() : [];
      if (!allTurns || allTurns.length < 1) {
        badge.innerText = 'SNAP: 대화 없음';
        badge.style.display = 'block';
        setTimeout(function(){ badge.style.display = 'none'; }, 3000);
        return;
      }
      var recentTurns = allTurns.slice(-10);
      var snapText = '[SNAP - 최근 ' + recentTurns.length + '턴]\n' +
        recentTurns.map(function(t){
          return '[' + t.role.toUpperCase() + ']\n' + t.text;
        }).join('\n\n') +
        '\n\n위 맥락을 참고하여 이어서 작업해주세요.';
      navigator.clipboard.writeText(snapText).then(function(){
        badge.innerText = '✓ SNAP 복사됨 (' + recentTurns.length + '턴)';
        badge.style.display = 'block';
        setTimeout(function(){ badge.style.display = 'none'; }, 4000);
      });
    };
    btnBox.appendChild(btnSnap);
    var btnSearch = document.createElement('button');
    btnSearch.id = 'ck-search-btn';
    btnSearch.innerText = 'SEARCH';
    btnSearch.style.cssText = 'background:#a78bfa;color:#0f172a;' + btnStyle;
    btnSearch.onclick = function() { CK.openSearchPanel(); };
    btnBox.appendChild(btnSearch);


    // === BRW 버튼 ===
    var btnBrowse = document.createElement('button');
    btnBrowse.id = 'ck-browse-btn';
    btnBrowse.innerText = 'BRW';
    btnBrowse.style.cssText = 'background:#f472b6;color:#0f172a;' + btnStyle;

    // ck-browse-panel은 content.js openBrowsePanel()에서 동적 생성

    btnBrowse.onclick = function() {
      CK.openBrowsePanel && CK.openBrowsePanel();
    };
    btnBox.appendChild(btnBrowse);

    // === MD 다운로드 버튼 ===
    var btnMd = document.createElement('button');
    btnMd.id = 'ck-md-btn';
    btnMd.innerText = 'MD';
    btnMd.style.cssText = 'background:#fbbf24;color:#0f172a;' + btnStyle;
    btnMd.onclick = function() {
      var turns = CK.extractTurns ? CK.extractTurns() : [];
      if (!turns || turns.length === 0) {
        CK.updateBadge('MD: 대화 없음');
        return;
      }
      // 클립보드 복사 (Obsidian/Notion용)
      CK.copyMd(turns).then(function() {
        CK.updateBadge('MD 클립보드 복사 완료 (' + turns.length + '턴)');
        setTimeout(function(){
          var b = document.getElementById('ck-badge');
          if (b) b.style.display = 'none';
        }, 3000);
      });
      // 파일 다운로드 동시 실행
      CK.downloadMd(turns);
      btnMd.innerText = '✓';
      setTimeout(function(){ btnMd.innerText = 'MD'; }, 1500);
    };
    btnBox.appendChild(btnMd);

    panel.appendChild(btnBox);
    panel.appendChild(badge);
    document.body.appendChild(panel);
  };


})();
