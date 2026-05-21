/**
 * AIKeep24-Lite - 공통 설정
 *
 * LLM 의존성 없음. WORKER_URL은 Mode B 사용자만 설정.
 */

var CKL = window.CKL || {};

CKL.CONFIG = {
  /** 한 청크에 담을 최대 턴 수 */
  TURNS_PER_CHUNK: 20,

  /** Mode B: Cloudflare Worker 엔드포인트 (Mode A 사용자는 무시) */
  WORKER_URL: '',

  /** 오토세이브 대기 시간 (ms): 마지막 새 턴 후 이 시간 idle이면 자동 저장 */
  AUTOSAVE_IDLE_MS: 60000,

  /** 해시 비교용 접두사 길이 (FNV-1a) */
  HASH_PREFIX_LEN: 100,

  /** SNAP 버튼: 클립보드에 복사할 최근 턴 수 */
  SNAP_TURNS: 10,

  /** 저장 모드: 'local' (IndexedDB) | 'cloud' (D1) */
  STORAGE_MODE: 'local',

  /**
   * 지원 플랫폼 맵.
   * turnSelector: null이면 parent-structure 방식(Claude) 사용.
   * roleDetect: 함수(el) → 'user' | 'assistant'
   */
  PLATFORMS: {
    genspark: {
      hostMatch: 'genspark.ai',
      turnSelector: '.conversation-item-desc',
      roleDetect: function(el) {
        return el.classList.contains('user') ? 'user' : 'assistant';
      },
      skipSelectors: 'img[src*="generated"], img[src*="dalle"], .image-generation'
    },
    chatgpt: {
      hostMatch: 'chatgpt.com',
      turnSelector: '[data-message-author-role]',
      roleDetect: function(el) {
        return el.getAttribute('data-message-author-role') || 'assistant';
      },
      skipSelectors: ''
    },
    claude: {
      hostMatch: 'claude.ai',
      turnSelector: null,          // parent-structure 방식
      roleDetect: 'parent-structure',
      skipSelectors: ''
    }
  },

  /** URL 패턴 중 저장 불필요한 경우 (이미지 생성 등) */
  SKIP_PATTERNS: ['/image/', '/draw/', '/art/']
};

/** 런타임 상태 (탭별) */
CKL.enabled = true;
CKL.isRunning = false;
CKL.lastTurnCount = 0;
CKL.lastNewTurnTime = 0;
CKL.autoSaveTimer = null;
CKL.autoSaveTriggered = false;

/**
 * FNV-1a 32bit 해시 — 변경 감지용
 * @param {string} text
 * @returns {string} hex string
 */
CKL.hashText = function(text) {
  var hash = 0x811c9dc5;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

/**
 * JSON 파싱 안전 래퍼
 * @param {string} str
 * @returns {*} 파싱 결과 또는 []
 */
CKL.tryParseJSON = function(str) {
  try { return JSON.parse(str); } catch(e) { return []; }
};

/**
 * RFC 4122 v4 UUID 생성 (crypto.randomUUID 미지원 환경 대비)
 * @returns {string}
 */
CKL.generateUUID = function() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * 현재 저장 모드 반환
 * @returns {Promise<string>} 'local' | 'cloud'
 */
CKL.getStorageMode = function() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['ckl_storage_mode'], function(result) {
      resolve(result.ckl_storage_mode || CKL.CONFIG.STORAGE_MODE);
    });
  });
};

window.CKL = CKL;
