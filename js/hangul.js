/* 한글 자소 분해·비교 유틸리티 (수행 기록·분석부 140에서 사용) */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};

  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  var JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var BASE = 0xAC00, END = 0xD7A3;

  function isSyllable(ch) {
    var c = ch.charCodeAt(0);
    return c >= BASE && c <= END;
  }

  /** 음절 하나를 {cho, jung, jong}으로 분해. 한글 음절이 아니면 null */
  function decompose(ch) {
    if (!ch || !isSyllable(ch)) return null;
    var code = ch.charCodeAt(0) - BASE;
    return {
      cho: CHO[Math.floor(code / 588)],
      jung: JUNG[Math.floor((code % 588) / 28)],
      jong: JONG[code % 28]
    };
  }

  /** 자소 3개로 음절 조합. 조합 불가하면 null */
  function compose(cho, jung, jong) {
    var i = CHO.indexOf(cho), j = JUNG.indexOf(jung), k = JONG.indexOf(jong || '');
    if (i < 0 || j < 0 || k < 0) return null;
    return String.fromCharCode(BASE + i * 588 + j * 28 + k);
  }

  /** 한글 음절만 남기고 정규화 */
  function normalize(text) {
    return (text || '').replace(/[^가-힣]/g, '');
  }

  /** 음절 단위 편집거리 */
  function levenshtein(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[m][n];
  }

  /** 0~1 유사도 */
  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a.length && !b.length) return 1;
    return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  }

  /**
   * 목표 표현과 응답을 자소 단위로 비교하여 서로 다른 자소 목록을 반환.
   * 예) diffJamo('발','벌') → [{index:0, pos:'jung', target:'ㅏ', heard:'ㅓ'}]
   */
  function diffJamo(target, heard) {
    target = normalize(target); heard = normalize(heard);
    var diffs = [];
    var n = Math.min(target.length, heard.length);
    for (var i = 0; i < n; i++) {
      var t = decompose(target[i]), h = decompose(heard[i]);
      ['cho', 'jung', 'jong'].forEach(function (pos) {
        if (t[pos] !== h[pos]) diffs.push({ index: i, pos: pos, target: t[pos], heard: h[pos] });
      });
    }
    return diffs;
  }

  /** 자소 거리 (같은 길이일 때 서로 다른 자소 수, 아니면 큰 값) */
  function jamoDistance(a, b) {
    a = normalize(a); b = normalize(b);
    if (a.length !== b.length) return 10 + Math.abs(a.length - b.length);
    return diffJamo(a, b).length;
  }

  /* ---------- 조사 처리 ---------- */
  function hasJong(word) {
    var w = normalize(word);
    if (!w) return false;
    var d = decompose(w[w.length - 1]);
    return !!(d && d.jong);
  }
  /** josa('발','이/가') → '발이' */
  function josa(word, pair) {
    var p = pair.split('/');
    return word + (hasJong(word) ? p[0] : p[1]);
  }

  SG.hangul = {
    CHO: CHO, JUNG: JUNG, JONG: JONG,
    isSyllable: isSyllable, decompose: decompose, compose: compose,
    normalize: normalize, levenshtein: levenshtein, similarity: similarity,
    diffJamo: diffJamo, jamoDistance: jamoDistance, hasJong: hasJong, josa: josa
  };
})(typeof window !== 'undefined' ? window : globalThis);
