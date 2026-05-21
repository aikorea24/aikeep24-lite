/**
 * AIKeep24-Lite - IndexedDB 스토어 (Mode A)
 *
 * DB명: aikeep24lite  버전: 1
 * Object Store:
 *   - chunks   (keyPath: chunk_id)
 *     인덱스: by_created (created_at), by_platform (platform), by_session (session_id)
 *   - sessions (keyPath: session_id)  — 세션 메타 캐시용
 */
(function() {
  'use strict';

  var CK = window.CK;
  var DB_NAME = 'aikeep24lite';
  var DB_VERSION = 1;
  var db = null; // 싱글턴 IDBDatabase 인스턴스

  /**
   * DB를 열고 싱글턴으로 캐시한다.
   * @returns {Promise<IDBDatabase>}
   */
  function openDB() {
    if (db) return Promise.resolve(db);

    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function(e) {
        var database = e.target.result;

        // chunks store
        if (!database.objectStoreNames.contains('chunks')) {
          var chunkStore = database.createObjectStore('chunks', { keyPath: 'chunk_id' });
          chunkStore.createIndex('by_created',  'created_at', { unique: false });
          chunkStore.createIndex('by_platform', 'platform',   { unique: false });
          chunkStore.createIndex('by_session',  'session_id', { unique: false });
        }

        // sessions store (세션 URL / 플랫폼 / 최근 접근 캐시)
        if (!database.objectStoreNames.contains('sessions')) {
          var sessionStore = database.createObjectStore('sessions', { keyPath: 'session_id' });
          sessionStore.createIndex('by_updated', 'updated_at', { unique: false });
        }

        console.log('[CK] IndexedDB schema created v' + DB_VERSION);
      };

      req.onsuccess = function(e) {
        db = e.target.result;
        console.log('[CK] IndexedDB opened');
        resolve(db);
      };

      req.onerror = function(e) {
        console.error('[CK] IndexedDB open failed', e.target.error);
        reject(e.target.error);
      };
    });
  }

  /**
   * 청크를 저장하고 sessions 스토어의 메타도 upsert한다.
   * @param {Object} chunk - StorageInterface 스키마 참고
   * @returns {Promise<void>}
   */
  CK.IndexedDBStore = {
    saveChunk: function(chunk) {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx = database.transaction(['chunks', 'sessions'], 'readwrite');

          // 청크 저장
          tx.objectStore('chunks').put(chunk);

          // 세션 메타 upsert
          var sessionMeta = {
            session_id:  chunk.session_id,
            session_url: chunk.session_url,
            platform:    chunk.platform,
            updated_at:  chunk.created_at
          };
          tx.objectStore('sessions').put(sessionMeta);

          tx.oncomplete = function() { resolve(); };
          tx.onerror    = function(e) { reject(e.target.error); };
        });
      });
    },

    /**
     * session_id로 청크 목록을 created_at 오름차순으로 반환한다.
     * @param {string} sessionId
     * @returns {Promise<Array>}
     */
    getChunksBySession: function(sessionId) {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx      = database.transaction('chunks', 'readonly');
          var index   = tx.objectStore('chunks').index('by_session');
          var req     = index.getAll(sessionId);
          req.onsuccess = function(e) {
            var items = e.target.result || [];
            items.sort(function(a, b) { return a.created_at < b.created_at ? -1 : 1; });
            resolve(items);
          };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    /**
     * 모든 청크를 반환한다 (minisearch 인덱스 빌드용).
     * 경고: 대용량 데이터에서 호출 시 메모리 주의. v0.1.0 상한 10,000청크.
     * @returns {Promise<Array>}
     */
    getAllChunks: function() {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx  = database.transaction('chunks', 'readonly');
          var req = tx.objectStore('chunks').getAll();
          req.onsuccess = function(e) { resolve(e.target.result || []); };
          req.onerror   = function(e) { reject(e.target.error); };
        });
      });
    },

    /**
     * chunk_id로 청크를 삭제한다.
     * @param {string} chunkId
     * @returns {Promise<void>}
     */
    deleteChunk: function(chunkId) {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx  = database.transaction('chunks', 'readwrite');
          var req = tx.objectStore('chunks').delete(chunkId);
          req.onsuccess = function() { resolve(); };
          req.onerror   = function(e) { reject(e.target.error); };
        });
      });
    },

    /**
     * 전체 청크 수를 반환한다.
     * @returns {Promise<number>}
     */
    count: function() {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx  = database.transaction('chunks', 'readonly');
          var req = tx.objectStore('chunks').count();
          req.onsuccess = function(e) { resolve(e.target.result); };
          req.onerror   = function(e) { reject(e.target.error); };
        });
      });
    },

    /**
     * 모든 세션 메타를 updated_at 내림차순으로 반환한다.
     * 검색 결과 UI의 "최근 세션" 목록에 사용.
     * @returns {Promise<Array>}
     */
    getAllSessions: function() {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx  = database.transaction('sessions', 'readonly');
          var req = tx.objectStore('sessions').getAll();
          req.onsuccess = function(e) {
            var items = e.target.result || [];
            items.sort(function(a, b) { return a.updated_at > b.updated_at ? -1 : 1; });
            resolve(items);
          };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    }
  };

})();
