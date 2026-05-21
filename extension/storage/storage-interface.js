/**
 * AIKeep24-Lite - 스토리지 공통 인터페이스
 *
 * Mode A(IndexedDB) / Mode B(Cloud D1) 모두 이 인터페이스를 구현한다.
 * content.js는 항상 이 인터페이스를 통해 저장/조회한다.
 *
 * 구현체가 반환하는 Promise는 모두 동일한 청크 객체 스키마를 따른다:
 * {
 *   chunk_id:    string,   // UUID
 *   session_id:  string,   // getChatId() 결과
 *   session_url: string,   // window.location.href
 *   platform:    string,   // 'chatgpt' | 'claude' | 'genspark'
 *   turn_start:  number,
 *   turn_end:    number,
 *   raw_content: string,   // formatChunk() 결과
 *   raw_ngrams:  string,   // generateKoreanNgrams() 결과
 *   created_at:  string    // ISO 8601
 * }
 */

var CKL = window.CKL || {};

/**
 * 스토리지 인터페이스 — 구현체가 반드시 override해야 할 메서드 목록.
 * 직접 호출하면 Error를 던진다.
 */
CKL.StorageInterface = {
  /** 청크 저장 @param {Object} chunk @returns {Promise<void>} */
  saveChunk: function() { return Promise.reject(new Error('Not implemented')); },

  /** session_id로 청크 목록 조회 @param {string} sessionId @returns {Promise<Array>} */
  getChunksBySession: function() { return Promise.reject(new Error('Not implemented')); },

  /** 모든 청크 조회 (검색 인덱스 빌드용) @returns {Promise<Array>} */
  getAllChunks: function() { return Promise.reject(new Error('Not implemented')); },

  /** 청크 삭제 @param {string} chunkId @returns {Promise<void>} */
  deleteChunk: function() { return Promise.reject(new Error('Not implemented')); },

  /** 전체 청크 수 반환 @returns {Promise<number>} */
  count: function() { return Promise.reject(new Error('Not implemented')); }
};

window.CKL = CKL;
