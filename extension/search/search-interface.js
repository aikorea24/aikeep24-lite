/**
 * AIKeep24-Lite - 검색 공통 인터페이스
 *
 * Mode A(local-search) / Mode B(cloud-search) 모두 이 메서드를 구현한다.
 *
 * 검색 결과 객체 스키마:
 * {
 *   chunk_id:    string,
 *   session_id:  string,
 *   session_url: string,
 *   platform:    string,
 *   created_at:  string,
 *   snippet:     string,   // 매칭 전후 문맥 (하이라이트 마커 포함)
 *   score:       number    // 관련도 점수 (높을수록 관련)
 * }
 */

var CKL = window.CKL;

CKL.SearchInterface = {
  /**
   * 인덱스를 초기화/빌드한다. 확장 시작 시 1회 호출.
   * @returns {Promise<void>}
   */
  init:   function() { return Promise.reject(new Error('Not implemented')); },

  /**
   * 쿼리로 청크를 검색한다.
   * @param {string} query
   * @param {Object} [opts]   - { platform, dateFrom, dateTo, limit }
   * @returns {Promise<Array>} 결과 배열 (스키마 위 참고)
   */
  search: function() { return Promise.reject(new Error('Not implemented')); },

  /**
   * 새 청크를 인덱스에 추가한다 (incremental update).
   * @param {Object} chunk
   * @returns {Promise<void>}
   */
  add:    function() { return Promise.reject(new Error('Not implemented')); }
};

window.CKL = CKL;
