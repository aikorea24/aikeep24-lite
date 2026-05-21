/**
 * AIKeep24-Lite Extension - 공통 설정
 * 원본 AIKeep24 config.js 기반 포팅. LLM 설정 제거.
 */

/* 원본과 동일: IIFE 없이 최상위 선언 */
var CKL = window.CKL || {};

CKL.CONFIG = {
  TURNS_PER_CHUNK: 20,
  WORKER_URL: '',
  AUTOSAVE_IDLE_MS: 60000,
  HASH_PREFIX_LEN: 100,
  SNAP_TURNS: 10,
  SKIP_PATTERNS: ['/image/', '/draw/', '/art/'],
  PLATFORMS: {
    genspark: {
      hostMatch: 'genspark.ai',
      turnSelector: '.conversation-item-desc',
      roleDetect: function(el) { return el.classList.contains('user') ? 'user' : 'assistant'; },
      skipSelectors: 'img[src*="generated"], img[src*="dalle"], .image-generation'
    },
    chatgpt: {
      hostMatch: 'chatgpt.com',
      turnSelector: '[data-message-author-role]',
      roleDetect: function(el) { return el.getAttribute('data-message-author-role') || 'assistant'; },
      skipSelectors: ''
    },
    claude: {
      hostMatch: 'claude.ai',
      turnSelector: null,
      roleDetect: 'parent-structure',
      skipSelectors: ''
    }
  }
};

CKL.enabled = true;
CKL.isRunning = false;
CKL.lastTurnCount = 0;
CKL.lastNewTurnTime = 0;
CKL.autoSaveTimer = null;
CKL.autoSaveTriggered = false;

CKL.hashText = function(text) {
  var hash = 0x811c9dc5;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

CKL.tryParseJSON = function(str) {
  try { return JSON.parse(str); } catch(e) { return []; }
};

CKL.generateUUID = function() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

/* 원본과 동일: loadSettings 패턴 유지 (Mode A/B 토글용) */
CKL.loadSettings = function(callback) {
  chrome.storage.local.get(['ckl_storage_mode', 'ckl_worker_url'], function(data) {
    if (data.ckl_worker_url) CKL.CONFIG.WORKER_URL = data.ckl_worker_url;
    CKL.CONFIG.STORAGE_MODE = data.ckl_storage_mode || 'local';
    console.log('[CKL] Settings loaded: mode=' + CKL.CONFIG.STORAGE_MODE);
    if (callback) callback();
  });
};

window.CKL = CKL;
