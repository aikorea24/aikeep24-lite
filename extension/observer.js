/**
 * AIKeep24-Lite - Observer (변경 감지 + 자동 저장)
 *
 * 기존 AIKeep24 observer.js 포팅.
 * 변경점:
 *  - CK → CKL 네임스페이스
 *  - summarizeAll() 제거 → saveChunkIfChanged() 호출 (LLM 없음)
 *  - checkPreviousContext() 제거 (INJ 기능 없음)
 *  - AUTORUN_IDLE_MS → AUTOSAVE_IDLE_MS
 *  - ensureUI: #ckl-panel 기준으로 변경
 */
(function() {
  'use strict';

  var CKL = window.CKL;

  /**
   * 현재 턴 수를 확인하고, 새 턴이 감지되면 자동 저장 타이머를 재설정한다.
   * burst(+50 이상) 감지 시 자동 저장 건너뜀 — 수동 저장 유도.
   */
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
        // 페이지 로드 시 기존 대화 일괄 감지 → 자동 저장 스킵
        console.log('[CKL] Burst detected (+' + diff + '), auto-save skipped.');
        CKL.autoSaveTriggered = true;
      }
    }
  };

  /**
   * 자동 저장 스케줄러.
   * 마지막 새 턴 감지 후 AUTOSAVE_IDLE_MS 동안 추가 턴이 없으면 저장 실행.
   * 대화 진행 중에는 절대 트리거하지 않는다.
   */
  function scheduleAutoSave() {
    if (CKL.autoSaveTimer) clearTimeout(CKL.autoSaveTimer);

    CKL.autoSaveTimer = setTimeout(function() {
      var elapsed = Date.now() - CKL.lastNewTurnTime;

      // idle 시간 미달: 그 사이 새 턴이 왔음 → 다시 대기
      if (elapsed < CKL.CONFIG.AUTOSAVE_IDLE_MS - 1000) {
        console.log('[CKL] AutoSave deferred (' + Math.round(elapsed / 1000) + 's elapsed)');
        scheduleAutoSave();
        return;
      }

      if (!CKL.autoSaveTriggered && !CKL.isRunning && CKL.enabled && CKL.lastTurnCount >= 2) {
        var turns = CKL.extractTurns();
        var chatId = CKL.getChatId();
        var hashKey = 'ckl_last_hash_' + chatId;
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

  /** MutationObserver: DOM 변경 시 1초 디바운스 후 턴 수 확인 */
  CKL.observer = new MutationObserver(function() {
    clearTimeout(window._cklDebounce);
    window._cklDebounce = setTimeout(CKL.checkForNewTurns, 1000);
  });

  /**
   * UI 패널이 없으면 삽입한다.
   * content.js의 init 루프에서 호출.
   */
  CKL.ensureUI = function() {
    if (!document.getElementById('ckl-panel') && document.body) {
      console.log('[CKL] Inserting ckl-panel');
      CKL.createUI();
    }
  };

})();
