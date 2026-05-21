/**
 * AIKeep24-Lite - content.js
 *
 * 진입점. 모든 모듈 로드 후 실행된다.
 * v0.1.0 역할:
 *  1. DOM 안정화 대기 후 UI 삽입
 *  2. MutationObserver 시작
 *  3. saveChunkIfChanged 구현 (DOM 추출 → IndexedDB 저장)
 *  4. SNAP 버튼 핸들러 연결
 */
(function() {
  'use strict';

  var CKL = window.CKL;

  /**
   * 현재 세션의 미저장 턴을 청크로 저장한다.
   * 해시 비교로 중복 저장을 방지한다.
   * 자동 저장(observer)과 수동 저장(버튼) 양쪽에서 호출된다.
   */
  CKL.saveChunkIfChanged = function() {
    if (CKL.shouldSkipConversation()) {
      console.log('[CKL] Skipping: image/art conversation');
      return;
    }

    CKL.isRunning = true;
    var turns    = CKL.extractTurns();
    var chatId   = CKL.getChatId();
    var hashKey  = 'ckl_last_hash_' + chatId;
    var currentHash = CKL.computeTurnHash(turns);

    if (turns.length < 2) {
      console.log('[CKL] Not enough turns (' + turns.length + '), skip save');
      CKL.isRunning = false;
      return;
    }

    chrome.storage.local.get([hashKey, 'ckl_saved_turns_' + chatId], function(stored) {
      var savedHash  = stored[hashKey] || '';
      var savedTurns = stored['ckl_saved_turns_' + chatId] || 0;

      if (savedHash === currentHash) {
        console.log('[CKL] Hash unchanged, skip save');
        CKL.isRunning = false;
        CKL.updateStatus('변경 없음');
        return;
      }

      // 신규 턴 범위 계산
      var turnStart = savedTurns;
      var turnEnd   = turns.length - 1;
      var newTurns  = turns.slice(turnStart);

      if (newTurns.length === 0) {
        CKL.isRunning = false;
        return;
      }

      var chunk = {
        chunk_id:    CKL.generateUUID(),
        session_id:  chatId,
        session_url: window.location.href,
        platform:    CKL.getPlatformKey(),
        turn_start:  turnStart,
        turn_end:    turnEnd,
        raw_content: CKL.formatChunk(newTurns),
        raw_ngrams:  CKL.generateKoreanNgrams(CKL.formatChunk(newTurns)),
        created_at:  new Date().toISOString()
      };

      CKL.IndexedDBStore.saveChunk(chunk).then(function() {
        // 저장 성공: 해시 + 저장 턴 수 업데이트
        var update = {};
        update[hashKey] = currentHash;
        update['ckl_saved_turns_' + chatId] = turns.length;
        chrome.storage.local.set(update);

        console.log('[CKL] Saved chunk ' + chunk.chunk_id + ' (turns ' + turnStart + '-' + turnEnd + ')');

        // 검색 인덱스 incremental update (비동기, 실패해도 저장은 유지)
        CKL.getStorageMode().then(function(mode) {
          var engine = mode === 'cloud' ? CKL.CloudSearch : CKL.LocalSearch;
          return engine.add(chunk);
        }).catch(function(e) { console.warn('[CKL] Search index add failed', e); });

        CKL.isRunning = false;
        CKL.updateStatus('저장됨 ✓');
        setTimeout(function() { CKL.updateStatus(''); }, 3000);

      }).catch(function(err) {
        console.error('[CKL] Save failed', err);
        CKL.isRunning = false;
        CKL.updateStatus('저장 실패 ✗');
      });
    });
  };

  /**
   * SNAP: 최근 N턴 raw text를 클립보드에 복사한다.
   */
  CKL.snapToClipboard = function() {
    var turns  = CKL.extractTurns();
    var recent = turns.slice(-CKL.CONFIG.SNAP_TURNS);
    if (recent.length === 0) {
      CKL.updateStatus('복사할 대화 없음');
      return;
    }
    var text = CKL.formatChunk(recent);
    navigator.clipboard.writeText(text).then(function() {
      CKL.updateStatus('최근 ' + recent.length + '턴 복사됨! Cmd+V로 붙여넣기');
      setTimeout(function() { CKL.updateStatus(''); }, 3000);
    }).catch(function(err) {
      console.error('[CKL] Clipboard write failed', err);
      CKL.updateStatus('클립보드 복사 실패');
    });
  };

  /**
   * 상태 텍스트를 UI 배지에 표시한다.
   * ui.js가 로드되기 전에 호출돼도 안전하도록 null 체크 포함.
   * @param {string} msg
   */
  CKL.updateStatus = function(msg) {
    var badge = document.getElementById('ckl-status');
    if (badge) badge.textContent = msg;
    if (msg) console.log('[CKL] Status: ' + msg);
  };

  /**
   * 초기화: DOM body 준비 대기 후 UI 삽입 + Observer 시작
   */
  function init() {
    if (!document.body) {
      setTimeout(init, 500);
      return;
    }

    CKL.ensureUI();

    // 검색 인덱스 초기화 (비동기, UI 차단 없음)
    CKL.getStorageMode().then(function(mode) {
      var engine = mode === 'cloud' ? CKL.CloudSearch : CKL.LocalSearch;
      return engine.init();
    }).then(function() {
      console.log('[CKL] Search engine ready');
    }).catch(function(err) {
      console.warn('[CKL] Search engine init failed', err);
    });

    // MutationObserver 시작: body 전체 변경 감지
    CKL.observer.observe(document.body, { childList: true, subtree: true });
    console.log('[CKL] Observer started on ' + CKL.getPlatformKey());

    // 초기 턴 수 기록 (burst 감지 기준점)
    CKL.lastTurnCount = CKL.extractTurns().length;
    console.log('[CKL] Initial turns: ' + CKL.lastTurnCount);
  }

  init();

})();
