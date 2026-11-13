'use strict';
/* 문장 쓰기 로직·데이터 검사: node writing-sentence/logic.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../js/hangul.js');
require('../js/engine.js');
require('./data.js');
require('./logic.js');

const SG = globalThis.SG;
const E = SG.engine;
const { data, logic: L } = SG.writingSentence;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name); throw e; }
}

test('3단계 구성: 321 문장 틀 / 322 순서 배열 / 323 그림 조합, 단계마다 4문제', () => {
  assert.deepEqual(data.levels.map((l) => [l.code, l.mode]), [['321', 'frame'], ['322', 'order'], ['323', 'compose']]);
  data.levels.forEach((l) => assert.equal(l.items.length, 4));
});

test('과제 id 와 그림이 겹치지 않음', () => {
  const ids = new Set(), pics = new Set();
  data.levels.forEach((l) => l.items.forEach((it) => {
    assert.ok(!ids.has(it.id), it.id); ids.add(it.id);
    assert.ok(!pics.has(it.picture), it.picture); pics.add(it.picture);
  }));
});

test('그림 파일이 있고, 출처 기록(credits.json)에 올라 있음', () => {
  const credits = fs.readFileSync(path.join(__dirname, '../writing-word/assets/credits.json'), 'utf8');
  Object.entries(data.vocab).forEach(([word, v]) => {
    const file = path.join(__dirname, v.src);
    assert.ok(fs.existsSync(file), word + ' 그림 없음: ' + v.src);
    assert.ok(credits.includes(path.basename(v.src)), word + ' 출처 기록 없음');
    assert.ok(v.alt && !v.alt.includes(word), word + ' 대체 텍스트에 낱말이 그대로 드러남');
  });
});

test('모든 목표 문장은 정답 카드로 완성되고, 허용 어순도 완성으로 분류', () => {
  data.levels.forEach((l) => l.items.forEach((it) => {
    const right = l.mode === 'frame' ? [it.picture] : it.cards.slice();
    const r = L.evaluate(it, l.mode, right, data.vocab);
    assert.equal(r.type, E.TYPE.REACHED, it.id);
    (it.accept || []).forEach((s) => {
      const r2 = L.evaluate(it, l.mode, s.split(' '), data.vocab);
      assert.equal(r2.type, E.TYPE.REACHED, it.id + ' 허용 어순 ' + s);
      assert.deepEqual(s.split(' ').slice().sort(), it.cards.slice().sort(), it.id + ' 허용 어순은 같은 카드로');
    });
  }));
});

test('1단계: 그림 낱말이 선택지에 있고, 다른 선택지는 그림 있는 낱말로 분류되어 자소 차이를 알려 줌', () => {
  data.levels[0].items.forEach((it) => {
    assert.ok(it.choices.includes(it.picture), it.id);
    assert.ok(data.vocab[it.picture], it.id);
    it.choices.filter((c) => c !== it.picture).forEach((c) => {
      const r = L.evaluate(it, 'frame', [c], data.vocab);
      assert.equal(r.type, E.TYPE.MEANINGFUL, it.id + ' ' + c);
      assert.equal(r.word, c);
      assert.equal(r.targetWord, it.picture);
      assert.ok(r.image && r.image.src, it.id + ' ' + c + ' 그림');
      assert.ok(r.diffs.length >= 1, it.id + ' ' + c + ' 자소 차이');
    });
  });
});

test('1단계 조사: 선택지 모두 같은 받침 여부라 문장 틀 조사가 어긋나지 않음', () => {
  data.levels[0].items.forEach((it) => {
    const jong = it.choices.map((c) => SG.hangul.hasJong(c));
    assert.ok(jong.every((j) => j === jong[0]), it.id);
  });
});

test('2단계: 어색한 차례는 완성이 아닌 C 로 분류, 그림 낱말은 문장 안에 있음', () => {
  data.levels[1].items.forEach((it) => {
    const wrong = it.cards.slice().reverse();
    if ((it.accept || []).includes(wrong.join(' '))) wrong.push(wrong.shift());
    const r = L.evaluate(it, 'order', wrong, data.vocab);
    assert.equal(r.type, E.TYPE.NONSENSE, it.id);
    assert.ok(it.cards.some((c) => E.stemOf(c, data.vocab) === it.picture), it.id);
  });
});

test('3단계: 비슷한 낱말 카드를 넣으면 그 그림과 달라진 자소를 보여 줌', () => {
  data.levels[2].items.forEach((it) => {
    assert.ok(it.extra && it.extra.length, it.id);
    it.extra.forEach((x) => {
      const stem = E.stemOf(x, data.vocab);
      assert.ok(stem && data.vocab[stem], it.id + ' ' + x + ' 그림');
      const pieces = it.cards.map((c) => (E.stemOf(c, data.vocab) === it.picture ? x : c));
      assert.notDeepEqual(pieces, it.cards, it.id);
      const r = L.evaluate(it, 'compose', pieces, data.vocab);
      assert.equal(r.type, E.TYPE.MEANINGFUL, it.id + ' ' + x);
      assert.equal(r.word, stem);
      assert.equal(r.targetWord, it.picture);
      assert.ok(r.diffs.length >= 1);
    });
  });
});

test('다른 낱말이 들어갈 수 있는 1·3단계 문제는 모두 엉뚱한 문장 장면이 있음', () => {
  [data.levels[0], data.levels[2]].forEach((l) => l.items.forEach((it) => {
    assert.ok(L.SCENES.includes(it.scene), it.id + ' scene ' + it.scene);
  }));
});

test('장면 아래 문장: 다른 낱말 안에서 달라진 글자만 표시', () => {
  const it = data.levels[0].items[0];
  const r = L.evaluate(it, 'frame', ['발'], data.vocab);
  assert.deepEqual(L.markSentence(r.sentence, r.word, r.diffs), [
    { text: '발', diff: true }, { text: '이 윙윙 날아요', diff: false }
  ]);
  const it3 = data.levels[2].items[3];
  const r3 = L.evaluate(it3, 'compose', ['하얀', '그림이', '둥둥', '떠가요'], data.vocab);
  assert.deepEqual(L.markSentence(r3.sentence, r3.word, r3.diffs), [
    { text: '하얀 ', diff: false }, { text: '그림', diff: true }, { text: '이 둥둥 떠가요', diff: false }
  ]);
  const r4 = L.evaluate(data.levels[0].items[2], 'frame', ['문'], data.vocab);
  assert.deepEqual(L.markSentence(r4.sentence, r4.word, r4.diffs).filter((s) => s.diff).map((s) => s.text), ['문']);
  assert.deepEqual(L.markSentence('개가 멍멍', null, []), [{ text: '개가 멍멍', diff: false }]);
});

test('빈 슬롯이 있으면 제출 문장을 만들지 않음', () => {
  const it = data.levels[1].items[0];
  assert.equal(L.evaluate(it, 'order', [it.cards[0], null, it.cards[2]], data.vocab), null);
  assert.equal(L.evaluate(it, 'order', it.cards.slice(0, 2), data.vocab), null);
});

test('카드 섞기: 같은 과제는 같은 순서, 처음부터 목표 순서로 놓이지 않음, 카드 빠짐 없음', () => {
  data.levels.forEach((l) => l.items.forEach((it) => {
    for (let salt = 0; salt < 20; salt++) {
      const a = L.shuffledPool(it, l.mode, salt);
      assert.deepEqual(a, L.shuffledPool(it, l.mode, salt));
      assert.deepEqual(a.map((c) => c.text).sort(), L.poolCards(it, l.mode).sort());
      if (l.mode !== 'frame') assert.notDeepEqual(a.slice(0, it.cards.length).map((c) => c.text), it.cards, it.id + ' ' + salt);
    }
  }));
});

test('힌트 카드: 두 번째 재시도부터 한 장씩, 마지막 카드는 늘 아이가 놓음, 1단계는 없음', () => {
  const it = data.levels[1].items[3]; // 카드 4장
  assert.deepEqual([0, 1, 2, 3, 4, 9].map((n) => L.hintCount(it, 'order', n)), [0, 0, 1, 2, 3, 3]);
  assert.equal(L.hintCount(data.levels[0].items[0], 'frame', 5), 0);
});

test('씨앗 대사·응원·과정 메시지에 평가 어휘 없음, 응원 문구는 이어서 반복되지 않음', () => {
  const lines = [];
  for (let n = 1; n <= 8; n++) {
    lines.push(L.encouragement('order', n), L.encouragement('frame', n), L.reachedLine(n));
    assert.notEqual(L.encouragement('order', n), L.encouragement('order', n + 1));
    assert.notEqual(L.encouragement('frame', n), L.encouragement('frame', n + 1));
  }
  data.levels.forEach((l) => lines.push(l.title, l.description, l.detail, l.guide));
  lines.forEach((s) => assert.deepEqual(E.findBanned(s), [], s));
});

test('자소 안내는 아이가 쓴 자소만 짚고 목표 자소는 드러내지 않음', () => {
  const notes = L.diffNotes('발', SG.hangul.diffJamo('벌', '발'));
  assert.deepEqual(notes, [{ index: 0, text: '‘발’의 가운뎃소리 ‘ㅏ’' }]);
  assert.ok(!notes[0].text.includes('ㅓ'));
});

test('진행 기록: 처음 완성만 first, 단계별 완료 수', () => {
  const state = {};
  const lv = data.levels[0];
  assert.equal(L.doneCount(state, lv), 0);
  assert.equal(L.markDone(state, lv.items[0].id), true);
  assert.equal(L.markDone(state, lv.items[0].id), false);
  L.markDone(state, lv.items[2].id);
  assert.equal(L.doneCount(state, lv), 2);
  assert.equal(L.doneCount(state, data.levels[1]), 0);
  const broken = { writingSentence: 'x' };
  assert.equal(L.isDone(broken, 'ws-1-1'), false);
});

console.log(`writing-sentence logic: ${passed} tests passed.`);
