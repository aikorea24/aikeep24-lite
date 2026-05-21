/**
 * AIKeep24-Lite - 한국어 n-gram 토크나이저
 *
 * 한국어 어절의 bigram + trigram을 생성해 FTS 매칭 정밀도를 보완한다.
 * Mode A(minisearch) 커스텀 토크나이저와 Mode B(FTS5) raw_ngrams 컬럼에 공통 사용.
 */
(function() {
  'use strict';

  var CKL = window.CKL;

  /**
   * 한글 어절에서 bigram + trigram을 생성한다.
   *
   * 예: "머신러닝" → ["머신", "신러", "러닝", "머신러", "신러닝"]
   *
   * @param {string} text - 원본 텍스트 (한글 포함 혼합 가능)
   * @returns {string} 공백 구분 n-gram 토큰 문자열
   */
  CKL.generateKoreanNgrams = function(text) {
    var korean = text.match(/[가-힣]+/g) || [];
    var ngrams = [];

    for (var w = 0; w < korean.length; w++) {
      var word = korean[w];

      // bigram
      for (var i = 0; i < word.length - 1; i++) {
        ngrams.push(word.slice(i, i + 2));
      }
      // trigram (3자 이상인 경우만)
      for (var j = 0; j < word.length - 2; j++) {
        ngrams.push(word.slice(j, j + 3));
      }
    }

    return ngrams.join(' ');
  };

  /**
   * 검색 쿼리를 n-gram 토큰으로 변환한다.
   * 저장 시 generateKoreanNgrams와 동일 변환을 적용해 FTS 매칭을 보장한다.
   *
   * @param {string} query - 사용자 검색어
   * @returns {string} n-gram 확장 쿼리 문자열
   */
  CKL.expandQueryNgrams = function(query) {
    var ngramPart = CKL.generateKoreanNgrams(query);
    // 원본 쿼리 토큰 + n-gram 토큰을 합쳐서 반환
    // FTS5/minisearch 양쪽에서 OR 매칭 가능하도록 공백 구분
    var parts = [query.trim()];
    if (ngramPart) parts.push(ngramPart);
    return parts.join(' ');
  };

  /**
   * 텍스트에서 한글 비율을 반환한다 (0.0 ~ 1.0).
   * n-gram 적용 필요 여부를 빠르게 판단하는 데 사용.
   *
   * @param {string} text
   * @returns {number}
   */
  CKL.koreanRatio = function(text) {
    if (!text || text.length === 0) return 0;
    var koreanChars = (text.match(/[가-힣]/g) || []).length;
    return koreanChars / text.length;
  };

})();
