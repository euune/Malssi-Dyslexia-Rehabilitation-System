/* ========================================
   말씨 – 쓰기 · 문장 놀이 화면 (level1~3.html 공통)
   <body data-level="1|2|3"> 으로 단계를 정함
     1단계 frame   : 문장 틀의 빈칸에 낱말 카드 하나 고르기
     2단계 order   : 섞인 낱말 카드를 차례대로 놓기
     3단계 compose : 문장 틀 없이 그림만 보고 카드 고르기 (비슷한 낱말 카드 섞임)

   피드백 원칙 (단어 읽기·단어 쓰기와 같음)
     - 씨앗 대사는 SG.seed.say → SG.engine.verifyText 로 평가어 검사
     - 다른 뜻의 낱말이 들어오면 그 낱말의 그림을 보여 주고, 실제로 달라진 자소만 파랗게 표시
     - 소리는 '문장 들어볼까요?' 버튼을 직접 눌렀을 때만 (자동 음성·시간 제한 없음)
======================================== */
(function () {
  'use strict';

  var SG = window.SG;
  var WS = SG.writingSentence;
  var L = WS.logic;
  var E = SG.engine;
  var data = WS.data;
  var app = document.getElementById('app');
  var levelNo = Number(document.body.dataset.level) || 1;
  var level = data.levels.filter(function (l) { return l.number === levelNo; })[0];
  if (!app || !level) return;
  var mode = level.mode;
  var state = SG.store.get();

  var SEED_START = {
    frame: '이 그림에 어울리는 낱말이 궁금해. 빈칸에 넣어 줄래?',
    order: '낱말 카드가 뒤섞였어! 차례대로 놓아 줄래?',
    compose: '이 그림을 문장으로 알려 줄래? 어울리는 카드를 골라 줘!'
  };

  var summary = { attempts: 0, retries: 0, reached: 0, bloomed: 0 };
  var run = null;     // 지금 문장의 진행 상태
  var finished = false;

  /* ---------- 작은 도구 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function say(text, intent, anim) {
    SG.seed.say(text, { intent: intent || 'generic', voice: false }); // 씨앗 목소리 자동 재생 안 함
    if (anim) SG.seed.react(anim);
  }
  function cardById(id) {
    for (var i = 0; i < run.pool.length; i++) if (run.pool[i].id === id) return run.pool[i];
    return null;
  }
  function pieces() { return run.slots.map(function (id) { var c = id == null ? null : cardById(id); return c ? c.text : null; }); }
  function used(id) { return run.slots.indexOf(id) >= 0; }
  function filled() { return run.slots.every(function (id) { return id != null; }); }

  /* ---------- 문장 시작 ---------- */
  function startItem(index) {
    recordLeave();
    var item = level.items[index];
    run = {
      index: index,
      item: item,
      pool: L.shuffledPool(item, mode, 0),
      slots: new Array(L.slotCount(item, mode)).fill(null),
      locked: 0,
      attempts: 0,
      retries: 0,
      reached: false,
      recorded: false,
      result: null,
      startedAt: Date.now()
    };
    finished = false;
    render('pool');
    say(SEED_START[mode], 'generic', 'nod');
  }

  /* ---------- 기록: 과제 이력(선생님 보기)과 진행 표시 ---------- */
  function record() {
    if (!run || run.recorded || !run.attempts) return;
    run.recorded = true;
    SG.store.addHistory({
      activity: 'write-sentence', id: run.item.id, level: levelNo,
      attempts: run.attempts, retries: run.retries, reached: run.reached, held: false,
      ms: Date.now() - run.startedAt, at: new Date().toISOString()
    });
  }
  function recordLeave() { if (run && !run.reached) record(); }

  /* ---------- 화면 그리기 ---------- */
  // 머리줄·씨앗 줄은 한 번만 그리고(씨앗 애니메이션·말풍선 유지), 과제 영역만 다시 그림
  app.innerHTML =
    '<section class="screen play-screen">' +
      '<div class="act-head">' +
        '<h1>문장 쓰기 · ' + level.number + '단계</h1>' +
        '<a class="garden-btn" href="select-level.html">단계 고르기</a>' +
      '</div>' +
      '<div class="selection-shell">' +
        '<div class="seed-strip stage">' +
          '<div class="seed-wrap"><svg id="seed" viewBox="0 0 200 200" role="img" aria-label="씨앗"></svg></div>' +
          '<div class="bubble" id="bubble" aria-live="polite"></div>' +
        '</div>' +
        '<div class="level-body play-body" id="playBody"></div>' +
      '</div>' +
    '</section>';
  SG.growth.update(true);
  var body = $('playBody');

  function render(focusKey) {
    body.innerHTML = finished ? finishHtml() : taskHtml();
    bind();
    var f = focusKey && body.querySelector('[data-focus="' + focusKey + '"]:not(:disabled)');
    if (f) f.focus({ preventScroll: true });
  }

  function stageNavHtml() {
    return '<nav class="stage-nav" aria-label="문장 고르기">' +
      level.items.map(function (it, i) {
        var done = L.isDone(state, it.id), cur = i === run.index;
        return '<button type="button" class="stage-btn' + (done ? ' done' : '') + (cur ? ' current' : '') + '" data-stage="' + i + '"' +
          (cur ? ' aria-current="step"' : '') + ' aria-label="' + (i + 1) + '번 문장' + (done ? ', 완성' : '') + '">' + (i + 1) + '</button>';
      }).join('') +
    '</nav>';
  }

  function pictureHtml(word, cls) {
    var v = data.vocab[word];
    return '<figure class="' + (cls || 'picture-box') + '">' +
      (v ? '<img src="' + esc(v.src) + '" alt="' + esc(v.alt) + '">' : '<span class="picture-blank"></span>') +
    '</figure>';
  }

  function slotHtml(k) {
    var id = run.slots[k], card = id == null ? null : cardById(id);
    var locked = k < run.locked, frozen = locked || run.reached;
    if (!card) {
      return '<span class="slot empty' + (mode === 'frame' ? ' blank' : '') + '" aria-label="' + (mode === 'frame' ? '빈칸' : (k + 1) + '번째 자리, 비어 있음') + '"></span>';
    }
    return '<button type="button" class="slot filled' + (locked ? ' hint' : '') + (run.reached ? ' reached' : '') + '" data-slot="' + k + '" data-focus="slot-' + k + '"' +
      (frozen ? ' disabled' : '') + ' aria-label="' + esc(card.text) + (frozen ? '' : ', 눌러서 빼기') + '">' +
      (locked ? '<span class="hint-mark" aria-hidden="true">🌱</span>' : '') + esc(card.text) + '</button>';
  }

  function lineHtml() {
    var slots = run.slots.map(function (_, k) { return slotHtml(k); }).join('');
    if (mode === 'frame') {
      var after = run.item.after;
      return '<p class="sentence-line frame" id="line">' +
        (run.item.before ? '<span class="frame-text">' + esc(run.item.before.trim()) + '</span> ' : '') +
        '<span class="frame-join">' + slots + '<span class="frame-text">' + esc(after.split(' ')[0]) + '</span></span> ' +
        '<span class="frame-text">' + esc(after.split(' ').slice(1).join(' ')) + '</span>' +
      '</p>';
    }
    return '<div class="sentence-line" id="line" role="group" aria-label="내가 만드는 문장">' + slots +
      (run.reached ? '<span class="frame-text end">.</span>' : '') + '</div>';
  }

  function poolHtml() {
    if (run.reached) return '';
    return '<div class="card-pool" role="group" aria-label="낱말 카드">' +
      run.pool.map(function (c) {
        var isUsed = used(c.id);
        return '<button type="button" class="word-card' + (isUsed ? ' used' : '') + '" data-card="' + c.id + '" data-focus="card-' + c.id + '"' +
          (isUsed ? ' disabled aria-hidden="true" tabindex="-1"' : '') + '>' + esc(c.text) + '</button>';
      }).join('') +
    '</div>';
  }

  /**
   * 아이가 만든 '엉뚱한 문장'을 그대로 보여 주는 장면.
   * 새 그림을 만들지 않고, 들어간 낱말의 기존 그림을 움직임·효과로 꾸밈 (움직임은 style.css 의 .scene-*)
   *   예) 발이 윙윙 날아요 → 발 그림이 하늘을 날아다님
   */
  function sceneHtml(scene, word, sentence) {
    var v = data.vocab[word];
    if (!v || L.SCENES.indexOf(scene) < 0) return pictureHtml(word, 'ws-feedback-visual');
    function img(cls) { return '<img class="actor' + (cls ? ' ' + cls : '') + '" src="' + esc(v.src) + '" alt="">'; }
    function deco(cls, text) { return '<span class="deco ' + cls + '" aria-hidden="true">' + text + '</span>'; }
    var inner = {
      fly:   deco('cloud c1', '☁️') + deco('cloud c2', '☁️') +
             '<div class="mover"><span class="speed" aria-hidden="true"></span>' + img() + deco('sound', '윙윙') + '</div>',
      eat:   '<div class="table"></div><div class="plate"></div>' + img('on-plate') +
             deco('spoon', '🥄') + deco('sound s1', '냠냠') + deco('crumb k1', '•') + deco('crumb k2', '•'),
      fall:  deco('cloud c1', '☁️') + deco('cloud c2', '☁️') + deco('cloud c3', '☁️') +
             img('drop d1') + img('drop d2') + img('drop d3') + '<div class="ground"></div>',
      pour:  img('pitcher') + img('bit b1') + img('bit b2') + img('bit b3') +
             '<div class="cup"><div class="fill"></div></div>',
      shine: '<div class="rays"></div>' + img('glow') +
             deco('spark p1', '✨') + deco('spark p2', '✨') + deco('spark p3', '✨') + deco('spark p4', '✨'),
      sing:  img('sway') + deco('note n1', '♪') + deco('note n2', '♫') + deco('note n3', '♪') + deco('sound s2', '짹짹'),
      float: deco('cloud c1', '☁️') + deco('cloud c3', '☁️') + '<div class="mover drift">' + img() + '</div>' + deco('sound s3', '둥둥')
    }[scene];
    return '<div class="scene scene-' + scene + '" role="img" aria-label="‘' + esc(sentence) + '’ 장면">' + inner + '</div>';
  }

  function feedbackHtml() {
    var r = run.result;
    if (run.reached) {
      return '<section class="ws-feedback done" aria-label="문장 완성">' +
        '<p class="ws-feedback-label">🌼 문장이 완성됐어요!</p>' +
        '<p class="ws-feedback-sentence">' + esc(r.sentence) + '.</p>' +
      '</section>';
    }
    if (!r) return '';
    if (r.type === E.TYPE.MEANINGFUL && r.word) {
      var notes = L.diffNotes(r.word, r.diffs);
      var caption = L.markSentence(r.sentence, r.word, r.diffs).map(function (seg) {
        return seg.diff ? '<span class="diff">' + esc(seg.text) + '</span>' : esc(seg.text);
      }).join('');
      return '<section class="ws-feedback" aria-label="새로운 문장 발견">' +
        '<p class="ws-feedback-label">🌼 새로운 문장이 피어났어요!</p>' +
        sceneHtml(run.item.scene, r.word, r.sentence) +
        '<p class="scene-caption">' + caption + '</p>' +
        (notes.length ? '<p class="ws-feedback-note"><span class="diff-key">파란 글자</span>는 맨 위 그림 속 낱말과 소리가 다른 곳이에요. ' +
          esc(notes.map(function (n) { return n.text; }).join(', ')) + ' 자리를 바꿔 볼까요?</p>' : '') +
      '</section>';
    }
    return '<section class="ws-feedback soft" aria-label="내가 만든 문장">' +
      '<p class="ws-feedback-made">내가 만든 문장: ' + esc(r.sentence) + '</p>' +
      (run.locked ? '<p class="ws-feedback-note">🌱 표시 카드는 씨앗이 먼저 놓아 둔 카드예요.</p>' : '') +
    '</section>';
  }

  function taskHtml() {
    var last = run.index === level.items.length - 1;
    return '<p class="instruction">' + esc(level.guide) + '</p>' +
      stageNavHtml() +
      pictureHtml(run.item.picture) +
      lineHtml() +
      poolHtml() +
      '<div class="ws-controls">' +
        '<button type="button" class="listen-btn" id="listenBtn" data-focus="listen">🔈 문장 들어볼까요?</button>' +
        (run.reached ? '' : '<button type="button" class="submit-btn" id="submitBtn" data-focus="submit"' + (filled() ? '' : ' disabled') + '>✍️ 씨앗에게 알려줄까요?</button>') +
      '</div>' +
      feedbackHtml() +
      '<button type="button" class="next-btn' + (run.reached ? ' ready' : '') + '" id="nextBtn" data-focus="next">' +
        (last ? '이 단계 마무리할까요? →' : '다음 문장으로 넘어가볼까요? →') +
      '</button>';
  }

  function finishMessages() {
    var msgs = [];
    var all = L.doneCount(state, level) === level.items.length;
    if (summary.reached) msgs.push('씨앗에게 멋진 문장을 알려 주었어요.');
    if (summary.retries >= 3) msgs.push('어려운 문장도 끝까지 카드를 옮겨 보았어요.');
    if (summary.bloomed) msgs.push('비슷한 낱말로 새로운 문장도 피워 보았어요.');
    if (!all) msgs.push('아직 만들지 않은 문장은 씨앗이 기다리고 있을게요.');
    if (!summary.attempts) msgs = ['씨앗이 다음 만남을 기다리고 있을게요.'];
    return msgs.map(function (m) { return E.verifyText(m, 'session'); });
  }

  function finishHtml() {
    var next = data.levels.filter(function (l) { return l.number === levelNo + 1; })[0];
    var all = L.doneCount(state, level) === level.items.length;
    var head = all ? '마쳤어요' : summary.attempts ? '여기까지 해 보았어요' : '둘러보았어요';
    return '<div class="finish">' +
      '<div class="big-emoji" aria-hidden="true">' + (summary.reached ? '🌸' : '🌱') + '</div>' +
      '<h2>' + level.number + '단계를 ' + head + '</h2>' +
      finishMessages().map(function (m) { return '<p class="process">' + esc(m) + '</p>'; }).join('') +
      '<div class="finish-actions">' +
        (next ? '<a class="next-btn ready" href="level' + next.number + '.html" data-focus="finish">' + next.number + '단계로 가볼까요? →</a>' : '') +
        '<a class="ghost-btn" href="select-level.html">단계 고르기</a>' +
        '<button type="button" class="ghost-btn" id="againBtn">1번 문장부터 또 만들기</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------- 조작 ---------- */
  function bind() {
    body.querySelectorAll('[data-card]').forEach(function (b) { b.addEventListener('click', function () { place(Number(b.dataset.card)); }); });
    body.querySelectorAll('[data-slot]').forEach(function (b) { b.addEventListener('click', function () { takeOut(Number(b.dataset.slot)); }); });
    body.querySelectorAll('[data-stage]').forEach(function (b) {
      b.addEventListener('click', function () { var i = Number(b.dataset.stage); if (i !== run.index) startItem(i); });
    });
    if ($('listenBtn')) $('listenBtn').addEventListener('click', listen);
    if ($('submitBtn')) $('submitBtn').addEventListener('click', submit);
    if ($('nextBtn')) $('nextBtn').addEventListener('click', next);
    if ($('againBtn')) $('againBtn').addEventListener('click', function () { summary = { attempts: 0, retries: 0, reached: 0, bloomed: 0 }; startItem(0); });
  }

  /** 카드 놓기: 1단계는 빈칸 하나를 바꾸고, 2·3단계는 앞쪽 빈자리부터 채움 */
  function place(id) {
    if (run.reached || used(id)) return;
    var k = mode === 'frame' ? 0 : run.slots.indexOf(null);
    if (k < 0) return;
    run.slots[k] = id;
    run.result = null; // 문장이 바뀌면 지난 피드백은 내림
    SG.speech.stopSpeaking();
    var nextCard = run.pool.filter(function (c) { return !used(c.id); })[0];
    render(filled() ? 'submit' : (nextCard ? 'card-' + nextCard.id : 'submit'));
  }

  /** 놓은 카드 빼기 (씨앗이 놓아 준 카드는 그대로) */
  function takeOut(k) {
    if (run.reached || k < run.locked || run.slots[k] == null) return;
    var id = run.slots[k];
    run.slots[k] = null;
    run.result = null;
    if (mode !== 'frame') { // 뒤쪽 카드를 앞으로 당겨 빈자리 없이
      var rest = run.slots.slice(k + 1);
      run.slots = run.slots.slice(0, k).concat(rest.filter(function (x) { return x != null; }));
      while (run.slots.length < L.slotCount(run.item, mode)) run.slots.push(null);
    }
    render('card-' + id);
  }

  /** 문장 들려주기: 버튼을 직접 눌렀을 때만 */
  function listen() {
    SG.speech.speak(L.targetOf(run.item, mode), 'model');
    SG.seed.react('sing');
  }

  /** 씨앗이 앞쪽 카드를 놓아 주는 힌트 */
  function applyHint() {
    var want = L.hintCount(run.item, mode, run.retries);
    if (want <= run.locked) return false;
    var taken = {};
    for (var k = 0; k < want; k++) {
      var text = run.item.cards[k];
      var card = run.pool.filter(function (c) { return c.text === text && !taken[c.id]; })[0];
      taken[card.id] = true;
    }
    var keep = run.slots.filter(function (id) { return id != null && !taken[id]; });
    var ids = Object.keys(taken).map(Number);
    var ordered = run.item.cards.slice(0, want).map(function (text) {
      var id = ids.filter(function (i) { return cardById(i).text === text; })[0];
      ids.splice(ids.indexOf(id), 1);
      return id;
    });
    run.slots = ordered.concat(keep).slice(0, L.slotCount(run.item, mode));
    while (run.slots.length < L.slotCount(run.item, mode)) run.slots.push(null);
    run.locked = want;
    return true;
  }

  function submit() {
    if (run.reached || !filled()) return;
    var r = L.evaluate(run.item, mode, pieces(), data.vocab);
    if (!r) return;
    SG.speech.stopSpeaking();
    run.attempts++; summary.attempts++;
    run.result = r;
    var tryExp = run.attempts === 1 ? E.CONFIG.exp.firstTry : E.CONFIG.exp.retry;

    if (r.type === E.TYPE.REACHED) {
      run.reached = true;
      summary.reached++;
      L.markDone(state, run.item.id);
      SG.store.save();
      record();
      render('next');
      say(L.reachedLine(summary.reached - 1), 'reached', 'happy');
      SG.growth.addExp(tryExp, { text: '✨', from: $('line') });
      SG.growth.addExp(E.CONFIG.exp.complete, { text: r.sentence, from: $('line'), big: true });
      return;
    }

    run.retries++; summary.retries++;
    if (r.type === E.TYPE.MEANINGFUL) {
      summary.bloomed++;
      if (r.diffs.length) SG.store.recordConfusion(r.diffs);
    }
    var hinted = applyHint();
    var free = run.pool.filter(function (c) { return !used(c.id); })[0];
    render(filled() || !free ? 'submit' : 'card-' + free.id);
    SG.growth.addExp(tryExp, { text: '✨', from: $('line') });

    if (r.type === E.TYPE.MEANINGFUL && r.word) {
      say(SG.hangul.josa(r.word, '이/가') + ' 나타났네! 그림 속 낱말은 어떻게 쓸까?', 'meaningful', 'surprise');
    } else {
      say(hinted ? '천천히 해 보자. 🌱 카드는 내가 먼저 놓아 둘게!' : L.encouragement(mode, run.retries), 'retry', 'tilt');
    }
  }

  function next() {
    SG.speech.stopSpeaking();
    recordLeave();
    if (run.index < level.items.length - 1) { startItem(run.index + 1); return; }
    finished = true;
    render('finish');
    say(summary.reached ? '오늘 알려준 문장, 씨앗이 잘 기억할게!' : '다음에 또 함께 문장을 만들자!', 'session', summary.reached ? 'hug' : 'nod');
  }

  window.addEventListener('pagehide', function () { recordLeave(); SG.speech.stopSpeaking(); });

  /* 처음 열면: 주소의 ?stage=n, 없으면 아직 완성하지 않은 첫 문장 */
  var fromUrl = Number(new URLSearchParams(location.search).get('stage'));
  var first = fromUrl >= 1 && fromUrl <= level.items.length ? fromUrl - 1
    : Math.max(0, level.items.findIndex(function (it) { return !L.isDone(state, it.id); }));
  startItem(first);
})();
