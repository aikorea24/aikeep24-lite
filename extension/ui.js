/**
 * AIKeep24-Lite - UI (최소 스텁)
 *
 * v0.1.0: SNAP + 저장 버튼 + 상태 배지만 포함.
 * 검색 UI는 Phase 2(v0.1.0 완성)에서 구현.
 */
(function() {
  'use strict';

  var CKL = window.CKL;

  /**
   * 화면 하단에 컨트롤 패널을 삽입한다.
   * 이미 존재하면 아무 작업도 하지 않는다.
   */
  CKL.createUI = function() {
    if (document.getElementById('ckl-panel')) return;

    var panel = document.createElement('div');
    panel.id = 'ckl-panel';
    panel.style.cssText = [
      'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
      'background:#1a1a2e', 'border:1px solid #444', 'border-radius:8px',
      'padding:8px 12px', 'display:flex', 'align-items:center', 'gap:8px',
      'font-family:system-ui,sans-serif', 'font-size:12px', 'color:#eee',
      'box-shadow:0 2px 12px rgba(0,0,0,0.5)'
    ].join(';');

    // 브랜드 레이블
    var label = document.createElement('span');
    label.textContent = 'CKL';
    label.style.cssText = 'color:#7c83ff;font-weight:700;letter-spacing:0.5px';

    // SAVE 버튼
    var saveBtn = document.createElement('button');
    saveBtn.textContent = 'SAVE';
    saveBtn.style.cssText = btnStyle('#2d6a4f', '#74c69d');
    saveBtn.onclick = function() {
      if (CKL.isRunning) return;
      CKL.saveChunkIfChanged();
    };

    // SNAP 버튼
    var snapBtn = document.createElement('button');
    snapBtn.textContent = 'SNAP';
    snapBtn.style.cssText = btnStyle('#1d3557', '#a8dadc');
    snapBtn.onclick = function() { CKL.snapToClipboard(); };

    // 상태 배지
    var status = document.createElement('span');
    status.id = 'ckl-status';
    status.style.cssText = 'color:#aaa;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

    panel.appendChild(label);
    panel.appendChild(saveBtn);
    panel.appendChild(snapBtn);
    panel.appendChild(status);
    document.body.appendChild(panel);

    console.log('[CKL] UI panel created');
  };

  /**
   * 버튼 공통 스타일 문자열 반환
   * @param {string} bg - 배경색
   * @param {string} color - 텍스트색
   * @returns {string}
   */
  function btnStyle(bg, color) {
    return [
      'background:' + bg, 'color:' + color, 'border:none',
      'border-radius:4px', 'padding:4px 8px', 'cursor:pointer',
      'font-size:11px', 'font-weight:600', 'letter-spacing:0.3px'
    ].join(';');
  }

})();
