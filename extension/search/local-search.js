/**
 * AIKeep24-Lite - 로컬 검색 엔진 (Mode A)
 *
 * minisearch 위에 n-gram 커스텀 토크나이저를 얹어
 * 한국어 부분 매칭을 지원한다.
 *
 * 인덱스 필드:
 *   - raw_content  : 원본 대화 텍스트
 *   - raw_ngrams   : 한국어 bigram+trigram (CK.generateKoreanNgrams)
 *   - platform, session_url, created_at : 메타 (검색 대상 제외, 필터용)
 *
 * 스니펫 추출:
 *   매칭 토큰 주변 ±60자를 잘라 <mark> 태그로 감싼다.
 *   UI에서 innerHTML로 렌더링한다.
 */
(function() {
  'use strict';

  var CK = window.CK;

  /** @type {MiniSearch|null} 싱글턴 인스턴스 */
  var _index = null;

  /** @type {Object.<string, Object>} chunk_id → chunk 전체 객체 캐시 */
  var _chunkCache = {};

  /**
   * minisearch 인스턴스를 생성한다.
   * raw_ngrams 필드에는 공백 구분 n-gram 토큰이 이미 저장되어 있으므로
   * tokenize를 공백 분리로 설정한다.
   * @returns {MiniSearch}
   */
  function createIndex() {
    return new MiniSearch({
      fields: ['raw_content', 'raw_ngrams'],
      storeFields: ['chunk_id', 'session_id', 'session_url', 'platform', 'created_at', 'raw_content'],
      idField: 'chunk_id',
      // raw_ngrams는 공백 분리 토큰이므로 기본 tokenize 그대로 사용
      searchOptions: {
        boost:     { raw_content: 2, raw_ngrams: 1 },
        prefix:    true,   // 접두사 매칭 (영어 부분 입력 지원)
        fuzzy:     0.15,   // 오타 허용 (0 = 완전 일치, 0.2 이하 권장)
        combineWith: 'OR'  // 다중 키워드: 하나라도 매칭
      }
    });
  }

  /**
   * IndexedDB의 모든 청크를 로드해 minisearch 인덱스를 빌드한다.
   * 확장 시작 시 1회 호출. 10,000청크 상한(v0.1.0).
   * @returns {Promise<void>}
   */
  CK.LocalSearch = {
    init: function() {
      _index = createIndex();
      _chunkCache = {};

      return CK.IndexedDBStore.getAllChunks().then(function(chunks) {
        if (chunks.length === 0) {
          console.log('[CK] LocalSearch: no chunks to index');
          return;
        }

        // 10,000 초과 시 최신 순으로 자름
        var toIndex = chunks.length > 10000
          ? chunks.sort(function(a,b){ return a.created_at > b.created_at ? -1 : 1; }).slice(0, 10000)
          : chunks;

        _index.addAll(toIndex);

        // 전체 객체 캐시 (스니펫 생성에 사용)
        toIndex.forEach(function(c) { _chunkCache[c.chunk_id] = c; });

        console.log('[CK] LocalSearch: indexed ' + toIndex.length + ' chunks');
        return _index;
      }).then(function(idx) { return idx || _index; });
    },

    /**
     * 쿼리 검색. n-gram 확장 후 minisearch에 전달.
     * @param {string} query
     * @param {Object} [opts] - { platform, dateFrom, dateTo, limit=20 }
     * @returns {Promise<Array>}
     */
    search: function(query, opts) {
      if (!_index) return Promise.resolve([]);
      opts = opts || {};

      // 한국어 포함 시 n-gram 확장 쿼리 사용
      var expandedQuery = CK.expandQueryNgrams(query);

      var raw = _index.search(expandedQuery, {
        boost:       { raw_content: 2, raw_ngrams: 1 },
        prefix:      true,
        fuzzy:       0.15,
        combineWith: 'OR'
      });

      // 메타 필터 적용
      var filtered = raw.filter(function(r) {
        var chunk = _chunkCache[r.id] || r;
        if (opts.platform && chunk.platform !== opts.platform) return false;
        if (opts.dateFrom && chunk.created_at < opts.dateFrom) return false;
        if (opts.dateTo   && chunk.created_at > opts.dateTo)   return false;
        return true;
      });

      var limit   = opts.limit || 20;
      var results = filtered.slice(0, limit).map(function(r) {
        var chunk = _chunkCache[r.id] || {};
        // MiniSearch storeFields에 raw_content가 포함되므로 cache miss 시 r에서 fallback
        var rawContent = chunk.raw_content || r.raw_content || '';
        return {
          chunk_id:    r.id,
          session_id:  chunk.session_id  || r.session_id  || '',
          session_url: chunk.session_url || r.session_url || '',
          platform:    chunk.platform    || r.platform    || '',
          created_at:  chunk.created_at  || r.created_at  || '',
          raw_content: rawContent,
          snippet:     extractSnippet(rawContent, query),
          score:       r.score || 0
        };
      });

      return Promise.resolve(results);
    },

    /**
     * 새 청크를 인덱스에 추가한다 (저장 직후 incremental update).
     * @param {Object} chunk
     * @returns {Promise<void>}
     */
    add: function(chunk) {
      if (!_index) return Promise.resolve();
      try {
        _index.add(chunk);
        _chunkCache[chunk.chunk_id] = chunk;
      } catch(e) {
        // 이미 인덱싱된 chunk_id면 무시
        console.warn('[CK] LocalSearch.add skipped (duplicate?):', e.message);
      }
      return Promise.resolve();
    }
  };

  /**
   * 매칭 쿼리 주변 ±60자를 추출하고 쿼리 키워드에 <mark> 태그를 씌운다.
   * @param {string} content - raw_content 전체
   * @param {string} query   - 사용자 검색어
   * @returns {string} HTML 스니펫 (innerHTML용)
   */
  function extractSnippet(content, query) {
    if (!content) return '';

    // 검색어의 첫 번째 단어로 위치 탐색
    var keyword = query.trim().split(/\s+/)[0];
    var idx = content.toLowerCase().indexOf(keyword.toLowerCase());
    var start = Math.max(0, idx > -1 ? idx - 60 : 0);
    var end   = Math.min(content.length, start + 200);
    var snippet = content.slice(start, end);

    // 앞뒤 말줄임 처리
    if (start > 0)              snippet = '…' + snippet;
    if (end < content.length)   snippet = snippet + '…';

    // XSS 방지 후 키워드 하이라이트
    snippet = escapeHTML(snippet);
    var keywords = query.trim().split(/\s+/).filter(function(k){ return k.length > 0; });
    keywords.forEach(function(kw) {
      var safe = escapeRegExp(escapeHTML(kw));
      snippet = snippet.replace(
        new RegExp('(' + safe + ')', 'gi'),
        '<mark style="background:#ffd166;color:#1a1a2e;padding:0 2px;border-radius:2px">$1</mark>'
      );
    });

    return snippet;
  }

  /** HTML 특수문자 이스케이프 */
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** RegExp 특수문자 이스케이프 */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

})();
