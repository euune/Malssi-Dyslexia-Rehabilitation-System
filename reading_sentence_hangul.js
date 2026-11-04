/*
 * 한글 비교 유틸
 * - 음성 인식 결과와 목표 문장을 초성·중성·종성(자소) 단위로 분해해 비교합니다.
 * - 문장 전체 유사도(score)와 단어별 유사도(words)를 함께 돌려줘서
 *   잘 전달되지 않은 단어만 골라 강조할 수 있게 합니다.
 */
(function (root) {
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  // 음성 인식기가 "하나 둘"을 "1 2"처럼 숫자로 돌려주는 경우를 대비
  const NATIVE = { 1: '하나', 2: '둘', 3: '셋', 4: '넷', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉', 10: '열' };
  const SINO = { 1: '일', 2: '이', 3: '삼', 4: '사', 5: '오', 6: '육', 7: '칠', 8: '팔', 9: '구', 10: '십' };

  /** 문장부호·공백 제거 */
  function normalize(s) {
    return String(s || '').replace(/[^0-9A-Za-z가-힣]/g, '');
  }

  /** 글자 → 자소 배열. 예) "발" → ['ㅂ','ㅏ','ㄹ'] */
  function decompose(str) {
    const out = [];
    for (const ch of String(str || '')) {
      const code = ch.charCodeAt(0) - 0xac00;
      if (code >= 0 && code < 11172) {
        out.push(CHO[Math.floor(code / 588)], JUNG[Math.floor((code % 588) / 28)]);
        const jong = code % 28;
        if (jong) out.push(JONG[jong]);
      } else {
        out.push(ch);
      }
    }
    return out;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /** 자소 단위 유사도 (0~1) */
  function similarity(a, b) {
    const x = decompose(normalize(a));
    const y = decompose(normalize(b));
    const len = Math.max(x.length, y.length);
    if (!len) return 1;
    return 1 - levenshtein(x, y) / len;
  }

  function variants(s) {
    const set = new Set([s]);
    if (/\d/.test(s)) {
      set.add(s.replace(/\d+/g, (m) => NATIVE[m] || m));
      set.add(s.replace(/\d+/g, (m) => SINO[m] || m));
    }
    return [...set];
  }

  /** 목표 문장의 단어마다, 들린 말에서 가장 비슷한 부분과의 유사도 */
  function wordScores(target, spoken) {
    const targetWords = target.split(/\s+/).filter(Boolean);
    const spokenWords = String(spoken || '').split(/\s+/).map(normalize).filter(Boolean);
    const joined = spokenWords.join('');
    return targetWords.map((w) => {
      const nw = normalize(w);
      if (!nw) return 1;
      if (joined.includes(nw)) return 1; // 띄어쓰기가 달라도 그대로 들어 있으면 OK
      let best = 0;
      for (let i = 0; i < spokenWords.length; i++) {
        for (let len = 1; len <= 3 && i + len <= spokenWords.length; len++) {
          best = Math.max(best, similarity(nw, spokenWords.slice(i, i + len).join('')));
        }
      }
      return best;
    });
  }

  /**
   * 목표 문장과 음성 인식 후보들을 비교
   * @param {string} target
   * @param {string|string[]} spokenList 인식 후보(여러 개 가능)
   * @returns {{score:number, spoken:string, words:number[], empty:boolean}}
   */
  function compareSentence(target, spokenList) {
    const list = [].concat(spokenList || []).filter((s) => s && normalize(s)).flatMap(variants);
    const wordCount = target.split(/\s+/).filter(Boolean).length;
    if (!list.length) return { score: 0, spoken: '', words: new Array(wordCount).fill(0), empty: true };
    let best = { score: -1, spoken: '' };
    for (const s of list) {
      const score = similarity(target, s);
      if (score > best.score) best = { score, spoken: s };
    }
    return { score: best.score, spoken: best.spoken, words: wordScores(target, best.spoken), empty: false };
  }

  const Hangul = { normalize, decompose, levenshtein, similarity, wordScores, compareSentence };
  if (typeof module !== 'undefined' && module.exports) module.exports = Hangul;
  else root.Hangul = Hangul;
})(typeof window !== 'undefined' ? window : globalThis);
