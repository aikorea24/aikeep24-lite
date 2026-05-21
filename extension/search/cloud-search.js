/**
 * AIKeep24-Lite - 클라우드 검색 (Mode B 스텁)
 *
 * Phase 3에서 구현. 현재는 인터페이스 정의만.
 * Worker의 /search/fts 엔드포인트를 호출한다.
 */
(function() {
  'use strict';

  var CK = window.CK;

  CK.CloudSearch = {
    init: function() {
      console.log('[CK] CloudSearch: Mode B not yet implemented (Phase 3)');
      return Promise.resolve();
    },

    search: function(query, opts) {
      // TODO Phase 3: fetch(CK.CONFIG.WORKER_URL + '/search/fts', ...)
      console.warn('[CK] CloudSearch.search not implemented');
      return Promise.resolve([]);
    },

    add: function(chunk) {
      // TODO Phase 3: fetch(CK.CONFIG.WORKER_URL + '/ingest', ...)
      return Promise.resolve();
    }
  };

})();
