(function() {
  var WORKER_DEFAULT = 'https://aikeep24lite-worker.hugh79757.workers.dev';

  function show(msg, isErr) {
    var el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + (isErr ? 'err' : 'ok');
    setTimeout(function() { el.textContent = ''; }, 3000);
  }

  // 저장된 값 로드
  chrome.storage.local.get(['ck_worker_url', 'ck_api_key'], function(d) {
    document.getElementById('worker_url').value = d.ck_worker_url || WORKER_DEFAULT;
    document.getElementById('api_key').value    = d.ck_api_key    || '';
    updateCurrentStatus(d.ck_api_key || '');
  });

  function updateCurrentStatus(apiKey) {
    var el = document.getElementById('current-status');
    if (apiKey) {
      el.innerHTML = '<span style="color:#34d399">✅ Mode B 활성</span> — 클라우드 동기화 ON<br>' +
        '<span style="color:#64748b">API Key: ' + apiKey.slice(0,12) + '...</span>';
    } else {
      el.innerHTML = '<span style="color:#67e8f9">🔵 Mode A 전용</span> — 로컬 IndexedDB만 사용';
    }
  }

  // 저장
  document.getElementById('btn-save').onclick = function() {
    var url = document.getElementById('worker_url').value.trim();
    var key = document.getElementById('api_key').value.trim();
    chrome.storage.local.set({ ck_worker_url: url, ck_api_key: key }, function() {
      show('✅ 저장 완료. 페이지 새로고침 후 적용됩니다.');
      updateCurrentStatus(key);
    });
  };

  // API Key 발급
  document.getElementById('btn-register').onclick = function() {
    var email = document.getElementById('reg_email').value.trim();
    var url   = document.getElementById('worker_url').value.trim() || WORKER_DEFAULT;
    if (!email || !email.includes('@')) { show('이메일을 입력하세요', true); return; }
    show('발급 중...');
    fetch(url + '/api/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d.ok) { show('오류: ' + d.error, true); return; }
      document.getElementById('api_key').value = d.api_key;
      chrome.storage.local.set({ ck_worker_url: url, ck_api_key: d.api_key }, function() {
        show(d.created ? '✅ 신규 발급 완료!' : '✅ 기존 Key 불러옴');
        updateCurrentStatus(d.api_key);
      });
    })
    .catch(function(e) { show('네트워크 오류: ' + e.message, true); });
  };

  // 초기화
  document.getElementById('btn-reset').onclick = function() {
    chrome.storage.local.remove(['ck_worker_url', 'ck_api_key'], function() {
      document.getElementById('api_key').value    = '';
      document.getElementById('worker_url').value = WORKER_DEFAULT;
      show('초기화 완료. Mode A로 전환됩니다.');
      updateCurrentStatus('');
    });
  };
})();
