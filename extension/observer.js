/**
 * AIKeep24-Lite Observer
 * LLM 제거, 자동저장만 수행
 */
(function() {
  var CK = window.CK;

  /** 새 턴 수 확인 및 자동저장 스케줄 */
  CK.checkForNewTurns = function() {
    if (!CK.enabled) return;
    var turns = CK.extractTurns ? CK.extractTurns() : [];
    var count = turns ? turns.length : 0;

    if (count > CK.lastTurnCount) {
      var diff = count - CK.lastTurnCount;
      console.log('[CK] +' + diff + ' new turns, total: ' + count);
      CK.lastTurnCount = count;

      if (diff <= 50) {
        CK.lastNewTurnTime = Date.now();
        clearTimeout(window._ckAutoSaveTimer);
        window._ckAutoSaveTimer = setTimeout(function() {
          var idle = Date.now() - CK.lastNewTurnTime;
          if (idle >= CK.CONFIG.AUTOSAVE_IDLE_MS - 1000) {
            console.log('[CK] AutoRun triggered (idle ' + Math.round(idle/1000) + 's)');
            CK.saveChunkIfChanged && CK.saveChunkIfChanged();
          }
        }, CK.CONFIG.AUTOSAVE_IDLE_MS);
      }
    }
  };

  CK.checkPreviousContext = function() { /* Phase 3에서 구현 */ };

  CK.observer = new MutationObserver(function() {
    clearTimeout(window._ckDebounce);
    window._ckDebounce = setTimeout(CK.checkForNewTurns, 1000);
  });

  CK.ensureUI = function() {
    if (!document.getElementById('ck-panel') && document.body) {
      console.log('[CK] Inserting ck-panel');
      CK.createUI();
    }
  };

})();
