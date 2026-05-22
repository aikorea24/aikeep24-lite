/**
 * AIKeep24-Lite - 클라우드 검색 (Mode B)
 *
 * Worker의 GET /api/search?q= 엔드포인트를 호출한다.
 * API_KEY가 없으면 자동으로 LocalSearch로 fallback.
 */
(function() {
  'use strict';

  var CK = window.CK;

  CK.CloudSearch = {
    init: function() {
      if (!CK.CONFIG.API_KEY) {
        console.log('[CK] CloudSearch: API_KEY 없음 → Mode A fallback');
        return Promise.resolve();
      }
      console.log('[CK] CloudSearch: Mode B 활성화');
      return Promise.resolve();
    },

    /**
     * Worker FTS5 검색
     * @param {string} query
     * @param {Object} [opts] - { platform, dateFrom, dateTo, limit }
     * @returns {Promise<Array>}
     */
    search: function(query, opts) {
      if (!CK.CONFIG.API_KEY || !CK.CONFIG.WORKER_URL) {
        return Promise.resolve([]);
      }
      opts = opts || {};
      var params = new URLSearchParams({ q: query });
      if (opts.platform) params.set('platform', opts.platform);
      if (opts.dateFrom) params.set('from', opts.dateFrom);
      if (opts.dateTo)   params.set('to', opts.dateTo);
      if (opts.limit)    params.set('limit', String(opts.limit));

      return fetch(CK.CONFIG.WORKER_URL + '/api/search?' + params.toString(), {
        headers: { 'Authorization': 'Bearer ' + CK.CONFIG.API_KEY }
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.ok) { console.warn('[CK] CloudSearch error:', data.error); return []; }
        // Worker snippet은 이미 <mark> HTML — raw_content도 함께 반환
        return (data.results || []).map(function(r) {
          return {
            chunk_id:    r.chunk_id    || '',
            session_id:  r.session_id  || '',
            session_url: r.session_url || '',
            platform:    r.platform    || '',
            created_at:  r.created_at  || '',
            raw_content: r.raw_content || '',
            snippet:     r.snippet     || '',
            score:       r.score       || 0,
            source:      'cloud'
          };
        });
      })
      .catch(function(e) {
        console.warn('[CK] CloudSearch fetch 오류:', e.message);
        return [];
      });
    },

    add: function() { return Promise.resolve(); }
  };

})();
