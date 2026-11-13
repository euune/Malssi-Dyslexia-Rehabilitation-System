/*
 * 말씨 – 쓰기 · 문장: 화면과 상관없는 순수 로직
 * 응답 분류는 공통 엔진(SG.engine.classifySentence, exact 모드)을 그대로 쓰고,
 * 여기서는 문장 만들기·카드 섞기·힌트 수·응원 문구·진행 기록만 다룹니다.
 * DOM 을 쓰지 않으므로 Node 테스트(logic.test.cjs)에서 그대로 불러옵니다.
 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var WS = SG.writingSentence = SG.writingSentence || {};
  var STORE_FIELD = 'writingSentence';

  function trimDot(s) { return String(s || '').replace(/[.!?]+$/, '').trim(); }

  /** 이 과제의 슬롯 수 (1단계는 빈칸 하나) */
  function slotCount(item, mode) { return mode === 'frame' ? 1 : item.cards.length; }

  /** 목표 문장 (마침표 없이) */
  function targetOf(item, mode) {
    if (mode === 'frame') return trimDot(item.before + item.picture + item.after);
    return item.cards.join(' ');
  }

  /** 아이가 놓은 카드로 만든 문장. 빈 슬롯이 있으면 null */
  function buildSentence(item, mode, pieces) {
    if (!pieces || pieces.length !== slotCount(item, mode)) return null;
    for (var i = 0; i < pieces.length; i++) if (!pieces[i]) return null;
    if (mode === 'frame') return trimDot(item.before + pieces[0] + item.after);
    return pieces.join(' ');
  }

  /** 고를 수 있는 카드 목록 (1단계: 낱말 선택지, 2단계: 문장 카드, 3단계: 문장 카드 + 비슷한 낱말 카드) */
  function poolCards(item, mode) {
    if (mode === 'frame') return item.choices.slice();
    return item.cards.concat(mode === 'compose' ? (item.extra || []) : []);
  }

  /** 문자열로 정해지는 의사 난수 — 같은 과제는 늘 같은 순서로 섞여 화면이 흔들리지 않음 */
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }

  /**
   * 카드 섞기. 섞은 결과가 목표 문장 순서와 같으면 한 칸 돌려서 처음부터 답이 보이지 않게 함.
   * @returns {{id:number, text:string}[]} 같은 글자 카드도 구분되도록 id 를 붙임
   */
  function shuffledPool(item, mode, salt) {
    var cards = poolCards(item, mode).map(function (text, id) { return { id: id, text: text }; });
    var rnd = seeded(item.id + ':' + (salt || 0));
    for (var i = cards.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = cards[i]; cards[i] = cards[j]; cards[j] = t;
    }
    if (mode !== 'frame' && cards.length > 1) {
      var inOrder = item.cards.every(function (c, k) { return cards[k] && cards[k].text === c; });
      if (inOrder) cards.push(cards.shift());
    }
    return cards;
  }

  /**
   * 제출 결과 분류
   * @returns {{type, sentence, word, targetWord, image, diffs}}
   *   type: SG.engine.TYPE (A 완성 / B 다른 뜻의 낱말 / C 어색한 차례)
   */
  function evaluate(item, mode, pieces, vocab) {
    var E = SG.engine;
    var sentence = buildSentence(item, mode, pieces);
    if (sentence === null) return null;
    var accept = (item.accept || []).map(trimDot);
    var r = E.classifySentence([sentence], targetOf(item, mode), vocab, { exact: true, accept: accept });
    return {
      type: r.type,
      sentence: sentence,
      word: r.word || null,
      targetWord: r.targetWord || null,
      image: r.image || null,
      diffs: r.diffs || []
    };
  }

  /**
   * 2·3단계에서 씨앗이 미리 놓아 주는 앞쪽 카드 수.
   * 처음 두 번은 스스로 해 보고, 그 뒤로 한 장씩 늘림. 마지막 한 장은 늘 아이가 놓음.
   */
  function hintCount(item, mode, retries) {
    if (mode === 'frame') return 0;
    return Math.max(0, Math.min(retries - 1, item.cards.length - 1));
  }

  var CHEERS = [
    '음… 조금 어색하게 들려. 카드 자리를 바꿔 볼까?',
    '거의 다 왔어! 누가, 무엇을 하는지 차례로 놓아 볼까?',
    '천천히 해도 괜찮아. 그림을 한 번 더 살펴볼까?',
    '좋아, 한 걸음씩 가 보자! 첫 카드부터 살펴볼까?',
    '네가 놓은 카드를 하나씩 읽어 볼까? 씨앗이 기다릴게.'
  ];
  var FRAME_CHEERS = [
    '음… 이 문장은 그림이랑 조금 달라 보여. 다른 카드도 넣어 볼까?',
    '천천히 골라도 괜찮아. 그림을 한 번 더 살펴볼까?',
    '좋아, 한 번 더 골라 보자! 씨앗이 기다릴게.'
  ];
  /** 재시도 응원 문구 (같은 말이 이어지지 않도록 차례로) */
  function encouragement(mode, retries) {
    var list = mode === 'frame' ? FRAME_CHEERS : CHEERS;
    return list[Math.max(0, retries - 1) % list.length];
  }

  var REACHED = [
    '문장이 활짝 피어났어. 고마워!',
    '아하, 이제 알겠어! 알려줘서 고마워!',
    '멋진 문장이야. 씨앗이 꼭 기억할게!'
  ];
  function reachedLine(n) { return REACHED[(n || 0) % REACHED.length]; }

  var POS_NAME = { cho: '첫소리', jung: '가운뎃소리', jong: '끝소리' };
  /**
   * 제출한 낱말에서 실제로 달라진 자소 안내. 목표 자소는 말하지 않고 아이가 쓴 자소만 짚음.
   * @returns {{index:number, text:string}[]} index: 제출 낱말 안의 글자 위치
   */
  function diffNotes(word, diffs) {
    return (diffs || []).map(function (d) {
      var heard = d.heard || '';
      return {
        index: d.index,
        text: '‘' + (word[d.index] || '') + '’의 ' + POS_NAME[d.pos] + (heard ? ' ‘' + heard + '’' : '')
      };
    });
  }

  /** '엉뚱한 문장' 장면 종류 (play.js 가 그림, style.css 가 움직임) */
  var SCENES = ['fly', 'eat', 'fall', 'pour', 'shine', 'sing', 'float'];

  /**
   * 아이가 만든 문장을 조각으로 나눠, 다른 낱말 안에서 실제로 달라진 글자만 diff 로 표시.
   * markSentence('발이 윙윙 날아요', '발', diffs) → [{text:'발', diff:true}, {text:'이 윙윙 날아요', diff:false}]
   */
  function markSentence(sentence, word, diffs) {
    var start = -1, pos = 0;
    var tokens = String(sentence).split(' ');
    for (var i = 0; i < tokens.length; i++) {
      if (word && tokens[i].indexOf(word) === 0) { start = pos; break; }
      pos += tokens[i].length + 1;
    }
    var marked = {};
    if (start >= 0) (diffs || []).forEach(function (d) { marked[start + d.index] = true; });
    var out = [];
    String(sentence).split('').forEach(function (ch, k) {
      var diff = !!marked[k], last = out[out.length - 1];
      if (last && last.diff === diff) last.text += ch; else out.push({ text: ch, diff: diff });
    });
    return out;
  }

  /* ---------- 진행 기록: 공통 저장소(seed-garden-v1) 안에 함께 둠 → 다른 기기와도 함께 맞춰짐 ---------- */
  function progressOf(state) {
    var p = state[STORE_FIELD];
    if (!p || typeof p !== 'object' || !p.done || typeof p.done !== 'object') p = state[STORE_FIELD] = { done: {} };
    return p;
  }
  function markDone(state, id) {
    var p = progressOf(state);
    var first = !p.done[id];
    p.done[id] = true;
    return first;
  }
  function isDone(state, id) { return !!progressOf(state).done[id]; }
  function doneCount(state, level) {
    return level.items.filter(function (it) { return isDone(state, it.id); }).length;
  }

  WS.logic = {
    trimDot: trimDot, slotCount: slotCount, targetOf: targetOf, buildSentence: buildSentence,
    poolCards: poolCards, shuffledPool: shuffledPool, evaluate: evaluate, hintCount: hintCount,
    encouragement: encouragement, reachedLine: reachedLine, diffNotes: diffNotes,
    SCENES: SCENES, markSentence: markSentence,
    progressOf: progressOf, markDone: markDone, isDone: isDone, doneCount: doneCount
  };
})(typeof window !== 'undefined' ? window : globalThis);
