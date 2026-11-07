/*
 * 간접 피드백부(170)
 *  - 응답 유형 분류 모듈(171)
 *  - 피드백 전략 결정 모듈(172)
 *  - 피드백 표현 생성 모듈(173)
 *  - 평가어 검증 모듈(174)
 *  - 과정 메시지 변환 모듈(175)
 * 그리고 성장 시각화부(180)의 경험치·성장 단계 정책.
 * DOM에 의존하지 않는 순수 로직이므로 Node 테스트에서 그대로 불러올 수 있다.
 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var H = SG.hangul;

  /* ---------------- 설정값 (서비스 설정에 따라 변경 가능한 예시 값) ---------------- */
  var CONFIG = {
    noResponseMs: 8000,          // 무응답(D) 기준 시간 – 단어
    noResponseSentenceMs: 15000, // 무응답(D) 기준 시간 – 문장
    taskTimeLimitMs: 120000,     // 소요 시간 기준 초과 시 L4
    holdAfterRetries: 4,         // 재시도 4회 이상 → L4 (보류 후 전환)
    confusionThreshold: 3,       // 혼동 음소 누적 빈도 기준 → 처음부터 L2
    sentenceAcceptSimilarity: 0.8,
    exp: { firstTry: 1, retry: 1, complete: 2 },
    stageThresholds: [10, 20, 30, 40, 50, 60]
  };

  var PARTICLES = ['이에요', '예요', '이요', '에게', '에서', '이랑', '랑', '이가', '은', '는', '이', '가', '을', '를', '에', '도', '와', '과', '의'];

  /** 조사·어미를 떼어 어휘 데이터에서 찾을 수 있는 줄기를 구한다 */
  function stemOf(word, vocab) {
    var w = H.normalize(word);
    if (vocab[w]) return w;
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      if (w.length > p.length && w.slice(-p.length) === p && vocab[w.slice(0, -p.length)]) {
        return w.slice(0, -p.length);
      }
    }
    return null;
  }

  /* ================= 응답 유형 분류 모듈 (171) ================= */
  var TYPE = { REACHED: 'A', MEANINGFUL: 'B', NONSENSE: 'C', NO_RESPONSE: 'D' };

  /**
   * 단어 응답 분류
   * @param {string[]|null} heardList 음성 인식 후보들(또는 선택 입력 1개). null/[] 이면 인식 실패
   * @param {string} target 목표 표현
   * @param {object} vocab 어휘 데이터
   * @param {object} [opt] {timedOut:boolean}
   */
  function classifyWord(heardList, target, vocab, opt) {
    opt = opt || {};
    if (opt.timedOut) return { type: TYPE.NO_RESPONSE, heard: '', diffs: [] };
    var list = (heardList || []).map(H.normalize).filter(Boolean);
    if (!list.length) return { type: TYPE.NONSENSE, heard: '', diffs: [] };
    var t = H.normalize(target);
    // A: 일치하거나 허용 범위 내 (예: "발이요", "발!" → 발)
    for (var i = 0; i < list.length; i++) {
      if (list[i] === t || stemOf(list[i], vocab) === t || (t.length >= 2 && list[i].indexOf(t) >= 0)) {
        return { type: TYPE.REACHED, heard: t, diffs: [] };
      }
    }
    // B: 목표와 다르나 어휘 데이터에 등록된 의미를 갖는 말 (자소상 가장 가까운 후보 우선)
    var best = null;
    list.forEach(function (h) {
      var s = stemOf(h, vocab);
      if (s && s !== t) {
        var dist = H.jamoDistance(t, s);
        if (!best || dist < best.dist) best = { word: s, dist: dist };
      }
    });
    if (best) {
      return { type: TYPE.MEANINGFUL, heard: best.word, image: vocab[best.word], diffs: H.diffJamo(t, best.word) };
    }
    // C: 어휘 데이터에 없는 조합
    return { type: TYPE.NONSENSE, heard: list[0], diffs: H.diffJamo(t, list[0]) };
  }

  /**
   * 문장 응답 분류
   * @param {string[]|null} heardList
   * @param {string} target
   * @param {object} vocab
   * @param {object} [opt] {timedOut, alternates: {문장: {img, word}}}
   */
  function classifySentence(heardList, target, vocab, opt) {
    opt = opt || {};
    if (opt.timedOut) return { type: TYPE.NO_RESPONSE, heard: '', diffs: [] };
    var list = (heardList || []).filter(function (s) { return H.normalize(s); });
    if (!list.length) return { type: TYPE.NONSENSE, heard: '', diffs: [] };
    var alternates = opt.alternates || {};
    var bestSim = -1, bestHeard = list[0];
    var accept = [target].concat(opt.accept || []).map(H.normalize);
    for (var i = 0; i < list.length; i++) {
      var sim = H.similarity(list[i], target);
      if (sim > bestSim) { bestSim = sim; bestHeard = list[i]; }
      // 쓰기 활동은 정확히 일치(어순 허용 목록 포함), 읽기 활동은 음성 인식 허용 범위 내 유사도
      if (opt.exact ? accept.indexOf(H.normalize(list[i])) >= 0 : sim >= CONFIG.sentenceAcceptSimilarity) {
        return { type: TYPE.REACHED, heard: list[i], similarity: sim, diffs: [] };
      }
    }
    // 등록된 대체 문장(의미 장면 이미지 보유)
    for (i = 0; i < list.length; i++) {
      for (var alt in alternates) {
        if (H.normalize(alt) === H.normalize(list[i])) {
          var a = alternates[alt];
          var pair = a.word ? swappedPair(target, alt, vocab) : null;
          return { type: TYPE.MEANINGFUL, heard: alt, image: a.img, word: a.word || null,
                   targetWord: pair ? pair.target : null,
                   diffs: pair ? H.diffJamo(pair.target, pair.heard) : [] };
        }
      }
    }
    // 목표 문장에 없는 어휘 단어가 끼어든 경우 (예: '발' 자리에 '벌')
    var targetStems = target.split(/\s+/).map(function (w) { return stemOf(w, vocab); }).filter(Boolean);
    var heardWords = bestHeard.split(/\s+/);
    for (i = 0; i < heardWords.length; i++) {
      var s = stemOf(heardWords[i], vocab);
      if (s && targetStems.indexOf(s) < 0 && bestSim >= 0.5) {
        var closest = targetStems.slice().sort(function (x, y) { return H.jamoDistance(x, s) - H.jamoDistance(y, s); })[0];
        if (closest && H.jamoDistance(closest, s) <= 2) {
          return { type: TYPE.MEANINGFUL, heard: bestHeard, word: s, targetWord: closest,
                   image: vocab[s], diffs: H.diffJamo(closest, s) };
        }
      }
    }
    return { type: TYPE.NONSENSE, heard: bestHeard, similarity: bestSim, diffs: [] };
  }

  /** 두 문장에서 서로 바뀐 어휘 단어 쌍 찾기 */
  function swappedPair(target, alt, vocab) {
    var tw = target.split(/\s+/), aw = alt.split(/\s+/);
    for (var i = 0; i < Math.min(tw.length, aw.length); i++) {
      if (tw[i] !== aw[i]) {
        var ts = stemOf(tw[i], vocab), as = stemOf(aw[i], vocab);
        if (ts && as) return { target: ts, heard: as };
      }
    }
    return null;
  }

  /* ================= 피드백 전략 결정 모듈 (172) ================= */
  var LEVEL = { L1: 1, L2: 2, L3: 3, L4: 4 };

  /** 목표 표현에 사용자의 자주 혼동하는 자소가 있는지 */
  function confusedJamoIn(target, confusion) {
    var out = [];
    H.normalize(target).split('').forEach(function (ch, idx) {
      var d = H.decompose(ch);
      ['cho', 'jung', 'jong'].forEach(function (pos) {
        if (d[pos] && (confusion[d[pos]] || 0) >= CONFIG.confusionThreshold) out.push({ index: idx, pos: pos, jamo: d[pos] });
      });
    });
    return out;
  }

  /**
   * 지원 수준 결정
   * @param {object} p {type, retries, elapsedMs, confusedHit:boolean}
   *   retries: 이 과제에서 목표 미도달 응답이 나온 횟수(이번 응답 포함)
   */
  function decideLevel(p) {
    if (p.type === TYPE.REACHED) return 0;
    if (p.retries >= CONFIG.holdAfterRetries || (p.elapsedMs || 0) > CONFIG.taskTimeLimitMs) return LEVEL.L4;
    var lv = Math.max(1, Math.min(3, p.retries));
    if (p.confusedHit) lv = Math.max(lv, LEVEL.L2); // 혼동 음소 이력 → 시작점 상향
    return lv;
  }

  /* ================= 평가어 검증 모듈 (174) ================= */
  var BANNED = ['정답', '오답', '틀렸', '틀린', '틀려', '실패', '점수', '훈련', '치료', '다시 해', '잘못', '맞혔', '맞았', '불합격', '감점'];
  var SAFE = {
    reached: '이제 알겠어. 고마워!',
    retry: '어? 잘 못 알아들었어. 한 번 더 들려줄래?',
    nonsense: '음… 처음 듣는 소리야. 한 번 더 들려줄래?',
    meaningful: '어, 새로운 말이 피어났어! 내가 궁금한 말은 어떻게 말해?',
    model: '내가 먼저 들려줄게. 이제 너도 들려줄래?',
    together: '우리 같이 읽어 볼까?',
    hold: '이 말은 씨앗이 꼭 기억해 둘게. 다음에 또 알려줘!',
    reread: '이 부분을 한 번 더 읽어줄래?',
    session: '오늘도 씨앗에게 많은 말을 들려주었어요.',
    generic: '함께해 줘서 고마워!'
  };

  function findBanned(text) {
    var hits = [];
    BANNED.forEach(function (w) { if (text.indexOf(w) >= 0) hits.push(w); });
    return hits;
  }

  /** 문장에 평가 어휘가 있으면 같은 의도의 대체 문장 템플릿으로 교체 */
  function verifyText(text, intent) {
    if (!findBanned(text).length) return text;
    var safe = SAFE[intent] || SAFE.generic;
    return findBanned(safe).length ? SAFE.generic : safe;
  }

  /* ================= 피드백 표현 생성 모듈 (173) ================= */
  function pick(arr, seed) { return arr[(seed || 0) % arr.length]; }

  /**
   * @param {object} p {type, level, target, heard, name, attempt}
   * @returns {{intent, text, anim, actions:string[]}}
   *  actions: 'bloom' 'compare' 'emphasize' 'point' 'modelVoice' 'readTogether' 'hold' 'next' 'highlight'
   */
  function buildFeedback(p) {
    var t = p.target, h = p.heard, n = p.attempt || 0, fb;
    if (p.type === TYPE.REACHED) {
      fb = { intent: 'reached', anim: 'nod', actions: ['next'],
             text: pick(['이제 알겠어. 고마워!', '‘' + t + '’! 나도 이제 말할 수 있어. 고마워!', '아하, ‘' + t + '’구나! 알려줘서 고마워!'], n) };
    } else if (p.level === LEVEL.L4) {
      fb = { intent: 'hold', anim: 'hug', actions: ['hold', 'next'], text: SAFE.hold };
    } else if (p.type === TYPE.NO_RESPONSE) {
      fb = { intent: 'model', anim: 'sing', actions: ['modelVoice', 'highlight'],
             text: '내가 먼저 들려줄게. ‘' + t + '’… 이제 너도 들려줄래?' };
    } else if (p.type === TYPE.MEANINGFUL) {
      var hw = p.word || h;
      fb = { intent: 'meaningful', anim: 'surprise', actions: ['bloom', 'compare'],
             text: H.josa(hw, '이/가') + ' 나타났네! 그럼 ‘' + (p.targetWord || t) + '’' + (H.hasJong(p.targetWord || t) ? '은' : '는') + ' 어떻게 말해?' };
      if (p.level === LEVEL.L2) { fb.actions.push('emphasize', 'point'); fb.text = H.josa(hw, '이/가') + ' 피어났어! 여기 이 소리가 궁금해. ‘' + (p.targetWord || t) + '’' + (H.hasJong(p.targetWord || t) ? '은' : '는') + ' 어떻게 말해?'; }
      if (p.level === LEVEL.L3) { fb.actions.push('emphasize', 'modelVoice', 'readTogether'); fb.text = H.josa(hw, '이/가') + ' 피어났어! 내가 먼저 들려줄게. 우리 같이 읽어 볼까?'; }
    } else { // NONSENSE
      fb = { intent: 'nonsense', anim: 'tilt', actions: [],
             text: p.level === LEVEL.L1 && n <= 1 ? SAFE.nonsense : '어? 잘 못 알아들었어. 한 번 더 들려줄래?' };
      if (p.level === LEVEL.L2) { fb.actions.push('emphasize', 'point'); fb.text = '음… 잘 못 알아들었어. 이 글자가 궁금해. 한 번 더 들려줄래?'; }
      if (p.level === LEVEL.L3) { fb.actions.push('emphasize', 'modelVoice', 'readTogether'); fb.text = '내가 먼저 들려줄게. 우리 같이 읽어 볼까?'; }
    }
    // L2 이상 무응답도 강조 추가
    if (p.type === TYPE.NO_RESPONSE && p.level >= LEVEL.L2 && p.level < LEVEL.L4) fb.actions.push('emphasize');
    fb.text = verifyText(fb.text, fb.intent);
    return fb;
  }

  /* ================= 과정 메시지 변환 모듈 (175) ================= */
  /**
   * @param {object} s 세션 기록 {attempts, retries, completed, held, quitEarly, totalReachMs, reachCount, bloomed}
   * @returns {string[]} 정량 수치가 없는 과정 중심 메시지
   */
  function processMessages(s) {
    var msgs = [];
    if (s.retries >= 3) msgs.push('어려운 소리도 끝까지 여러 번 들려주었어요.');
    if (s.reachCount && s.totalReachMs / s.reachCount > 20000) msgs.push('천천히 끝까지 알려줬어요. 씨앗도 차근차근 배우고 있어요!');
    if (s.bloomed > 0) msgs.push('비슷한 소리로 새로운 말도 피워 보았어요.');
    if (s.held > 0) msgs.push('어떤 말은 씨앗이 기억해 두었어요. 다음에 또 들려주세요!');
    if (s.quitEarly) msgs.push('오늘 알려준 말은 씨앗이 잘 기억하고 있을게요. 다음에 또 들려주세요!');
    if (!msgs.length) msgs.push(s.attempts > 0 ? '오늘도 씨앗에게 많은 말을 들려주었어요.' : '씨앗이 다음 만남을 기다리고 있을게요.');
    return msgs.map(function (m) { return verifyText(m, 'session'); });
  }

  /* ================= 성장 시각화부 (180) ================= */
  var STAGES = ['아기 씨앗', '씨앗', '발아', '새싹', '묘목', '성목', '꽃·열매'];
  function stageOf(exp) {
    var s = 0;
    CONFIG.stageThresholds.forEach(function (th, i) { if (exp >= th) s = i + 1; });
    return s;
  }
  /** 다음 단계까지의 진행률 (0~1, 숫자는 화면에 표시하지 않음) */
  function stageProgress(exp) {
    var s = stageOf(exp), th = CONFIG.stageThresholds;
    if (s >= th.length) return 1;
    var lo = s === 0 ? 0 : th[s - 1], hi = th[s];
    return (exp - lo) / (hi - lo);
  }

  SG.engine = {
    CONFIG: CONFIG, TYPE: TYPE, LEVEL: LEVEL, BANNED: BANNED, STAGES: STAGES,
    stemOf: stemOf, classifyWord: classifyWord, classifySentence: classifySentence,
    confusedJamoIn: confusedJamoIn, decideLevel: decideLevel,
    findBanned: findBanned, verifyText: verifyText, buildFeedback: buildFeedback,
    processMessages: processMessages, stageOf: stageOf, stageProgress: stageProgress
  };
})(typeof window !== 'undefined' ? window : globalThis);
