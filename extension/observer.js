/**
 * AIKeep24 - Observer (변경 감지 + 오토런)
 * 해시 기반 변경 감지 + 5분 idle 자동 실행
 */
(function() {
  var CKL = window.CKLL;

  CKL.checkForNewTurns = function() {
    var current = CKL.extractTurns();
    if (current.length > CKL.lastTurnCount) {
      var diff = current.length - CKL.lastTurnCount;
      console.log('[CKL] +' + diff + ' new turns, total: ' + current.length);
      CKL.lastTurnCount = current.length;

      if (diff <= 50) {
        CKL.lastNewTurnTime = Date.now();
        CKL.autoSaveTriggered = false;
        scheduleAutoSave();
      } else {
        console.log('[CKL] Burst detected (+' + diff + '), auto-run skipped. Use Run button.');
        CKL.autoSaveTriggered = true;
      }
    }
  };

  /**
   * 오토런: 마지막 새 턴 감지 후 5분간 추가 턴 없을 때만 자동 실행
   * 대화 중에는 절대 트리거하지 않음
   */
  function scheduleAutoSave() {
    if (CKL.autoSaveTimer) clearTimeout(CKL.autoSaveTimer);
    CKL.autoSaveTimer = setTimeout(function() {
      // 5분 후 재확인: 그 사이 새 턴이 있었으면 다시 대기
      var now = Date.now();
      var elapsed = now - CKL.lastNewTurnTime;
      if (elapsed < CKL.CONFIG.AUTOSAVE_IDLE_MS - 1000) {
        // 아직 idle 시간 안 됨 (다른 턴이 중간에 왔음)
        console.log('[CKL] AutoSave deferred, not idle enough (' + Math.round(elapsed / 1000) + 's)');
        scheduleAutoSave();
        return;
      }

      if (!CKL.autoSaveTriggered && !CKL.isRunning && CKL.enabled && CKL.lastTurnCount >= 2) {
        // 해시 비교로 실제 변경 확인
        var turns = CKL.extractTurns();
        var chatId = CKL.getChatId();
        var hashKey = 'ck_last_hash_' + chatId;
        var currentHash = CKL.computeTurnHash(turns);

        chrome.storage.local.get([hashKey], function(stored) {
          var savedHash = stored[hashKey] || '';
          if (savedHash === currentHash) {
            console.log('[CKL] AutoSave skipped: hash unchanged');
            return;
          }
          CKL.autoSaveTriggered = true;
          console.log('[CKL] AutoSave triggered (idle ' + Math.round(elapsed / 1000) + 's)');
          CKL.updateStatus('자동 저장 중...');
          CKL.saveChunkIfChanged();
        });
      }
    }, CKL.CONFIG.AUTOSAVE_IDLE_MS);
  }

  CKL.observer = new MutationObserver(function() {
    clearTimeout(window._cklDebounce);
    window._cklDebounce = setTimeout(CKL.checkForNewTurns, 1000);
  });


  CKL.ensureUI = function() {
    if (!document.getElementById('ckl-panel') && document.body) {
      console.log('[CKL] Inserting ck-panel');
      CKL.createUI();
    }
  };

})();
