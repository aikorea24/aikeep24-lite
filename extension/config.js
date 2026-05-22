/**
 * AIKeep24 Extension - 공통 설정
 */
var CK = window.CK || {};

CK.CONFIG = {
  AUTORUN_IDLE_MS: 5 * 60 * 1000,
  AUTOSAVE_IDLE_MS: 30 * 1000,
  TURNS_PER_CHUNK: 20,
  HASH_PREFIX_LEN: 100,
  SKIP_PATTERNS: ['/image/', '/draw/', '/art/'],
  KNOWN_PROJECTS: ['AIKeep24', 'TV-show', 'TAP', 'aikorea24', 'news-keyword-pro', 'KDE-keepalive'],
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

// Mode B: Cloudflare Worker 설정
CK.CONFIG.WORKER_URL = 'https://aikeep24lite-worker.hugh79757.workers.dev';
CK.CONFIG.API_KEY    = '';  // chrome.storage.local에서 로드

CK.enabled = true;
CK.isRunning = false;
CK.lastTurnCount = 0;
CK.lastNewTurnTime = 0;
CK.autoRunTimer = null;
CK.autoRunTriggered = false;

CK.hashText = function(text) {
  var hash = 0x811c9dc5;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

CK.tryParseJSON = function(str) {
  try { return JSON.parse(str); } catch(e) { return []; }
};

CK.loadSettings = function(callback) {
  var keys = [
    'ck_backend',
    'ck_worker_url', 'ck_api_key',
    'ck_ollama_model', 'ck_ollama_url', 'ck_worker_url',
    'ck_optiq_url', 'ck_optiq_model',
    'ck_neurons_url', 'ck_neurons_model',
    'ck_num_ctx', 'ck_num_predict', 'ck_temperature',
    'ck_turns_per_chunk', 'ck_max_text_len', 'ck_thinking'
  ];
  console.log('[CK-DEBUG] loadSettings called');
  chrome.storage.local.get(keys, function(data) {
    console.log('[CK-DEBUG] storage callback fired');
    if (data.ck_ollama_url) {
      CK.CONFIG.OLLAMA_TAGS_URL = data.ck_ollama_url + '/api/tags';
    }
    if (data.ck_worker_url) CK.CONFIG.WORKER_URL = data.ck_worker_url;
    if (data.ck_api_key)    CK.CONFIG.API_KEY    = data.ck_api_key;
    if (data.ck_turns_per_chunk) CK.CONFIG.TURNS_PER_CHUNK = parseInt(data.ck_turns_per_chunk);
    if (data.ck_max_text_len) CK.CONFIG.MAX_TEXT_LEN = parseInt(data.ck_max_text_len);
    CK.CONFIG.THINKING = data.ck_thinking === 'true';
    if (callback) callback();
  });
};

window.CK = CK;
